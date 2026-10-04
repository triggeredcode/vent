import { createHash } from "node:crypto";
import { Client, Connection, WorkflowExecutionAlreadyStartedError } from "@temporalio/client";
import type { JournalEntry } from "../lib/types";
import { TASK_QUEUE, type WriteJournalInput } from "./shared";
import type { writeJournalPage } from "./workflows";

/** Journal pages are written through Temporal by default (localhost:7233); TEMPORAL_ADDRESS=off disables it. */
export const temporalAddress = () => process.env.TEMPORAL_ADDRESS?.trim() || "localhost:7233";
export const temporalEnabled = () => temporalAddress().toLowerCase() !== "off";

const namespace = () => process.env.TEMPORAL_NAMESPACE ?? "default";

/** Thrown when Temporal can't take the job at all (server down, no worker) — the caller should use the direct path. */
export class TemporalUnavailableError extends Error {}

/** Thrown when the workflow is running but did not finish in time. It keeps running; the page will still be saved. */
export class StillWritingError extends Error {}

const cache = globalThis as typeof globalThis & { __ventTemporal?: Promise<Client> };

function getClient() {
  cache.__ventTemporal ??= Connection.connect({ address: temporalAddress(), connectTimeout: "3s" })
    .then((connection) => new Client({ connection, namespace: namespace() }))
    .catch((error) => {
      cache.__ventTemporal = undefined;
      throw error;
    });
  return cache.__ventTemporal;
}

/** Same request → same workflow id, so a retried POST ("Try again") joins the existing run instead of writing a second page. */
export function journalWorkflowId(input: WriteJournalInput, requestId?: string) {
  const key = requestId?.trim() || createHash("sha256").update(JSON.stringify([input.date, input.keepTranscript, input.turns.map((turn) => [turn.speaker, turn.text])])).digest("hex").slice(0, 24);
  return `journal-${input.date}-${key.replace(/[^\w-]/g, "").slice(0, 64)}`;
}

/**
 * Runs writeJournalPage on the "vent-journal" task queue and waits up to `waitMs` for the page.
 * Throws TemporalUnavailableError before anything durable has started (caller falls back to the direct path).
 */
export async function writeJournalPageDurably(input: WriteJournalInput, options: { requestId?: string; waitMs?: number } = {}): Promise<{ entry: JournalEntry; workflowId: string }> {
  const workflowId = journalWorkflowId(input, options.requestId);
  let client: Client;
  try {
    client = await getClient();
    // A workflow with no worker would just wait in the queue; only hand it over when a worker is polling.
    const queue = await client.workflowService.describeTaskQueue({ namespace: namespace(), taskQueue: { name: TASK_QUEUE }, taskQueueType: 1 /* WORKFLOW */ });
    if (!queue.pollers?.length) throw new Error(`no worker is polling "${TASK_QUEUE}" (run \`pnpm worker\`)`);
  } catch (error) {
    throw new TemporalUnavailableError(error instanceof Error ? error.message : String(error));
  }

  let handle;
  try {
    handle = await client.workflow.start<typeof writeJournalPage>("writeJournalPage", {
      taskQueue: TASK_QUEUE,
      workflowId,
      args: [input],
      // Running → join it. Completed → reject (we read its result below). Failed → allowed to run again.
      workflowIdConflictPolicy: "USE_EXISTING",
      workflowIdReusePolicy: "ALLOW_DUPLICATE_FAILED_ONLY",
    });
  } catch (error) {
    if (!(error instanceof WorkflowExecutionAlreadyStartedError)) throw new TemporalUnavailableError(error instanceof Error ? error.message : String(error));
    handle = client.workflow.getHandle<typeof writeJournalPage>(workflowId);
  }

  const waitMs = options.waitMs ?? 110_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new StillWritingError(`Workflow ${workflowId} is still writing the page.`)), waitMs);
  });
  try {
    return { entry: await Promise.race([handle.result(), timeout]), workflowId };
  } finally {
    clearTimeout(timer);
  }
}
