import { ActivityFailure, log, proxyActivities } from "@temporalio/workflow";
import type * as activities from "./activities";
import type { JournalEntry } from "../lib/types";
import type { WriteJournalInput } from "./shared";

const { extractDay } = proxyActivities<typeof activities>({
  // Gemma on a laptop can be loading, busy with a call, or slow: give each try 3 minutes, back off between tries.
  startToCloseTimeout: "3 minutes",
  // A worker that dies mid-extraction (laptop app restarted) stops heartbeating; retry on a live worker soon after.
  heartbeatTimeout: "20 seconds",
  retry: { initialInterval: "5s", backoffCoefficient: 2, maximumInterval: "30s", maximumAttempts: 5, nonRetryableErrorTypes: ["ValidationError"] },
});

const { embedPage } = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds",
  retry: { initialInterval: "1s", backoffCoefficient: 2, maximumInterval: "10s", maximumAttempts: 3 },
});

const { savePage } = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds",
  retry: { initialInterval: "1s", backoffCoefficient: 2, maximumInterval: "20s", maximumAttempts: 10 },
});

/**
 * Durable version of createEntryFromCall: extract → embed → save.
 * The call's turns are the workflow input, so if Ollama hiccups or the app/worker
 * restarts mid-way, Temporal resumes from the last completed step and the page is not lost.
 */
export async function writeJournalPage(input: WriteJournalInput): Promise<JournalEntry> {
  // The drafted entry (including its id) is recorded in history, so retries and replays reuse it.
  const entry = await extractDay(input);

  let embedding: number[] | undefined;
  try {
    embedding = await embedPage(entry);
  } catch (error) {
    // Same as the direct path: a page without an embedding is still a page (keyword memory search still finds it).
    if (!(error instanceof ActivityFailure)) throw error;
    log.warn("Saving page without an embedding", { entryId: entry.id });
  }

  await savePage(entry, embedding);
  return entry;
}
