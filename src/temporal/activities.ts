import { ApplicationFailure, heartbeat } from "@temporalio/activity";
import { draftEntry, embedEntry, saveEntry } from "../lib/journal";
import type { JournalEntry } from "../lib/types";
import type { WriteJournalInput } from "./shared";

/**
 * Activities wrap the exact same steps as the direct path (src/lib/journal.ts),
 * so a page written through Temporal is identical to one written without it.
 */

/** Gemma reads the call and drafts the page. Slow, and the step most likely to time out. */
export async function extractDay({ turns, date, keepTranscript }: WriteJournalInput): Promise<JournalEntry> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw ApplicationFailure.nonRetryable(`Invalid date: ${date}`, "ValidationError");
  if (!turns.some((turn) => turn.speaker === "you" && turn.text?.trim())) {
    throw ApplicationFailure.nonRetryable("Nothing was said on this call.", "ValidationError");
  }
  // Heartbeat while Gemma thinks, so a crashed worker is noticed in seconds rather than after the 3-minute timeout.
  const beat = setInterval(() => heartbeat(), 5_000);
  try {
    return await draftEntry(turns, date, keepTranscript);
  } finally {
    clearInterval(beat);
  }
}

/** Local embedding for memory search. Throws so Temporal retries; the workflow saves without it if Ollama never answers. */
export async function embedPage(entry: JournalEntry): Promise<number[]> {
  const embedding = await embedEntry(entry);
  if (!embedding?.length) throw ApplicationFailure.retryable("Embedding model unavailable", "EmbeddingUnavailable");
  return embedding;
}

/** Upsert by id, so a retried save never duplicates a page. */
export async function savePage(entry: JournalEntry, embedding?: number[]): Promise<void> {
  await saveEntry(entry, embedding);
}
