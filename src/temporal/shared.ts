import type { CallTurn } from "../lib/types";

/** Shared by the API route (client), the worker and the workflow. Keep this file free of Node imports. */
export const TASK_QUEUE = "vent-journal";

export interface WriteJournalInput {
  turns: CallTurn[];
  date: string;
  keepTranscript: boolean;
}
