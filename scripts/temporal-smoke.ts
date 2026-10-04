/**
 * Smoke test for the optional Temporal pipeline: starts writeJournalPage with a sample call
 * through the same client function the API route uses, and prints the resulting page.
 *   temporal server start-dev & pnpm worker &
 *   pnpm exec tsx scripts/temporal-smoke.ts [requestId]
 * The page is saved to your journal; delete it from the app (or DELETE /api/journal/<id>) afterwards.
 */
import { writeJournalPageDurably } from "../src/temporal/client";
import type { CallTurn } from "../src/lib/types";

process.env.TEMPORAL_ADDRESS ||= "localhost:7233";

const turns: CallTurn[] = [
  { speaker: "vent", text: "Hey. How was today?" },
  { speaker: "you", text: "Long. The standup ran over again and Priya and I argued about the release date." },
  { speaker: "vent", text: "That sounds tiring." },
  { speaker: "you", text: "It was, but we got chai at the corner stall after and sorted it out. I walked home by the lake and felt much lighter." },
];

const today = new Date();
const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
const requestId = process.argv[2] ?? `smoke-${Date.now().toString(36)}`;

const startedAt = Date.now();
writeJournalPageDurably({ turns, date, keepTranscript: true }, { requestId, waitMs: Number(process.env.WAIT_MS ?? 110_000) })
  .then(({ entry, workflowId }) => {
    console.log(JSON.stringify({ workflowId, ms: Date.now() - startedAt, entry }, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(`${error?.constructor?.name}: ${error?.message}`);
    process.exit(1);
  });
