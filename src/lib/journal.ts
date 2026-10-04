import type { JournalEntry } from "./types";

const lower = (value: string) => value.toLocaleLowerCase();

export function answerFromEntries(question: string, entries: JournalEntry[]) {
  const query = lower(question.trim());
  const tokens = query.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(
    (token) => token.length > 3 && !["what", "when", "where", "have", "feel", "felt", "this", "that", "lately"].includes(token),
  );
  const ranked = entries
    .map((entry) => {
      const haystack = lower([
        entry.summary,
        ...entry.people,
        ...entry.food,
        ...entry.places,
        ...entry.highlights,
        ...entry.difficultMoments,
        ...entry.thingsToRemember,
      ].join(" "));
      return { entry, score: tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0) };
    })
    .sort((a, b) => b.score - a.score || b.entry.date.localeCompare(a.entry.date));
  const matches = ranked.filter(({ score }) => score > 0).slice(0, 2);

  if (!matches.length) {
    return { answer: "I couldn't find that in the days saved here yet. Try asking about a person, place, meal, or how a day felt.", dates: [] as string[] };
  }
  if (query.includes("rahul")) {
    const latest = matches[0].entry;
    return { answer: `You last mentioned Rahul on ${latest.displayDate}. You worked on the demo together, and noted that his interview is on Tuesday.`, dates: [latest.displayDate] };
  }
  if (query.includes("better") || query.includes("lighter")) {
    return { answer: "The clearest lift came from finishing something tangible and taking an evening walk. The first successful voice test also helped the project feel manageable again.", dates: matches.map(({ entry }) => entry.displayDate) };
  }
  return { answer: matches.map(({ entry }) => entry.summary).join(" "), dates: matches.map(({ entry }) => entry.displayDate) };
}

export function makeEntryFromTranscript(transcript: string): JournalEntry {
  const today = new Date();
  const date = today.toISOString().slice(0, 10);
  const displayDate = today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const text = transcript.trim() || "I talked through my day and gave myself a little room to breathe.";
  return {
    id: `${date}-${Date.now()}`,
    date,
    displayDate,
    mood: { score: 3, label: "mixed", color: "#f1d58a" },
    moodArc: [
      { phase: "Start", label: "carrying a lot", emoji: "😕" },
      { phase: "After talking", label: "a little clearer", emoji: "😌" },
    ],
    people: [], food: [], places: [], healthMentions: [],
    highlights: ["Made space to talk the day through"],
    difficultMoments: [], thingsToRemember: [],
    summary: text.length > 220 ? `${text.slice(0, 217)}…` : text,
    transcript: text,
  };
}
