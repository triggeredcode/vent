import { NextResponse } from "next/server";
import { createEntryFromCall } from "@/lib/journal";
import { localDate } from "@/lib/mood";
import { getStore } from "@/lib/store";
import type { CallTurn, JournalEntry } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  const store = getStore();
  return NextResponse.json({ entries: await store.list(), storage: store.kind });
}

/** Optional durable path: a Temporal workflow (see src/temporal). Returns undefined when Temporal can't take the job. */
async function writeWithTemporal(turns: CallTurn[], date: string, keepTranscript: boolean, requestId?: string): Promise<JournalEntry | undefined> {
  if (!process.env.TEMPORAL_ADDRESS?.trim()) return undefined;
  // Loaded lazily so the default path never touches the Temporal client.
  const { writeJournalPageDurably, TemporalUnavailableError, StillWritingError } = await import("@/temporal/client");
  try {
    const { entry, workflowId } = await writeJournalPageDurably({ turns, date, keepTranscript }, { requestId, waitMs: 110_000 });
    console.info(`[journal] page ${entry.id} written by Temporal workflow ${workflowId}`);
    return entry;
  } catch (error) {
    if (error instanceof TemporalUnavailableError) {
      console.warn(`[journal] Temporal unavailable (${error.message}); writing the page directly.`);
      return undefined;
    }
    if (error instanceof StillWritingError) throw new Error("Still writing your page. It will appear in your journal shortly.");
    // WorkflowFailedError → ActivityFailure → ApplicationFailure: surface the innermost reason.
    let root: unknown = error;
    while (root instanceof Error && root.cause instanceof Error) root = root.cause;
    throw root;
  }
}

export async function POST(request: Request) {
  const body = await request.json() as { turns?: CallTurn[]; date?: string; keepTranscript?: boolean; requestId?: string };
  const turns = (body.turns ?? []).filter((turn) => turn.text?.trim());
  if (!turns.some((turn) => turn.speaker === "you")) return NextResponse.json({ error: "Nothing was said on this call." }, { status: 400 });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date ?? "") ? body.date! : localDate();
  const keepTranscript = body.keepTranscript !== false;
  const requestId = body.requestId ?? request.headers.get("idempotency-key") ?? undefined;

  try {
    const entry = await writeWithTemporal(turns, date, keepTranscript, requestId) ?? await createEntryFromCall(turns, date, keepTranscript);
    return NextResponse.json({ entry });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not write the page." }, { status: 503 });
  }
}
