export type MoodLabel = "bright" | "good" | "mixed" | "low" | "rough";

export interface MoodPoint {
  phase: string;
  label: string;
  emoji: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  displayDate: string;
  mood: { score: 1 | 2 | 3 | 4 | 5; label: MoodLabel; color: string };
  moodArc: MoodPoint[];
  people: string[];
  food: string[];
  places: string[];
  healthMentions: string[];
  highlights: string[];
  difficultMoments: string[];
  thingsToRemember: string[];
  summary: string;
  transcript?: string;
}

export type Screen = "home" | "call" | "journal" | "memory" | "day";
export type CallMode = "vent" | "journal";

export interface ListenerTurn {
  id: string;
  speaker: "you" | "vent";
  text: string;
}
