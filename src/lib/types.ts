export type MoodLabel = "bright" | "good" | "mixed" | "low" | "rough";
export type MoodScore = 1 | 2 | 3 | 4 | 5;

export interface MoodPoint {
  phase: string;
  label: string;
  emoji: string;
}

export interface JournalEntry {
  id: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  displayDate: string;
  title: string;
  mood: { score: MoodScore; label: MoodLabel; color: string };
  moodArc: MoodPoint[];
  people: string[];
  food: string[];
  places: string[];
  healthMentions: string[];
  highlights: string[];
  difficultMoments: string[];
  thingsToRemember: string[];
  summary: string;
  /** The day retold in the caller's own first-person voice. */
  journal: string;
  transcript?: string;
  createdAt: string;
}

export type Screen = "home" | "call" | "after-call" | "journal" | "memory" | "day";
export type CallMode = "vent" | "journal";

export type ListenerAction = "silence" | "acknowledge" | "follow_up" | "clarify" | "reflect_briefly";

export interface CallTurn {
  speaker: "you" | "vent";
  text: string;
  action?: ListenerAction;
}

export interface MemoryAnswer {
  answer: string;
  entryIds: string[];
}
