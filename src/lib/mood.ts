import type { MoodLabel, MoodScore } from "./types";

export const moodPalette: Record<MoodScore, { label: MoodLabel; color: string; ink: string }> = {
  5: { label: "bright", color: "#f0c947", ink: "#3b2f0b" },
  4: { label: "good", color: "#a8c8a0", ink: "#1f3a24" },
  3: { label: "mixed", color: "#99bfd3", ink: "#1b3644" },
  2: { label: "low", color: "#c7b3dc", ink: "#33244a" },
  1: { label: "rough", color: "#e99377", ink: "#4a1d10" },
};

export function moodFor(score: number) {
  const clamped = Math.min(5, Math.max(1, Math.round(score))) as MoodScore;
  return { score: clamped, ...moodPalette[clamped] };
}

export function inkFor(color: string) {
  return Object.values(moodPalette).find((mood) => mood.color === color)?.ink ?? "#25302b";
}

/** YYYY-MM-DD in the device's own timezone, never UTC. */
export function localDate(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function displayDateFor(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}

export function monthShort(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", { month: "short" }).toUpperCase();
}
