import { answerQuestion, embed, extractDay, type ExtractedDay } from "./ollama";
import { displayDateFor, moodFor } from "./mood";
import { getStore, pageText } from "./store";
import type { CallTurn, JournalEntry, MemoryAnswer } from "./types";

const clean = (items: unknown, limit = 8) =>
  Array.isArray(items) ? [...new Set(items.map((item) => String(item).trim()).filter(Boolean))].slice(0, limit) : [];

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const calendarWords = new Set(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "diwali", "holi", "eid", "christmas"]);

/** Gemma likes Title Case; magazine headlines here are sentence case, keeping names intact. */
function sentenceCase(title: string, names: string[]) {
  const proper = new Set(names.flatMap((name) => name.split(/\s+/)).map((word) => word.toLowerCase()));
  return title.split(/\s+/).map((word, index) => {
    if (index === 0) return capitalise(word);
    const bare = word.replace(/[^\p{L}']/gu, "").toLowerCase();
    if (calendarWords.has(bare)) return capitalise(word.toLowerCase());
    return proper.has(bare) || /^[A-Z]{2,}$/.test(word) ? word : word.toLowerCase();
  }).join(" ");
}

export function entryFromExtraction(extracted: Partial<ExtractedDay>, turns: CallTurn[], date: string): JournalEntry {
  const caller = turns.filter((turn) => turn.speaker === "you").map((turn) => turn.text).join(" ").trim();
  const mood = moodFor(Number(extracted.mood_score) || 3);
  const arc = Array.isArray(extracted.mood_arc)
    ? extracted.mood_arc.filter((point) => point?.label).slice(0, 4).map((point) => ({ phase: capitalise(String(point.phase || "").trim()), label: String(point.label).trim().toLowerCase(), emoji: String(point.emoji || "•").trim() }))
    : [];
  return {
    id: `${date}-${Date.now().toString(36)}`,
    date,
    displayDate: displayDateFor(date),
    title: sentenceCase(extracted.title?.trim().replace(/[.!]$/, "") || "A day, talked through", [...clean(extracted.people), ...clean(extracted.places), ...clean(extracted.food)]),
    mood: { score: mood.score, label: mood.label, color: mood.color },
    moodArc: arc,
    people: clean(extracted.people),
    food: clean(extracted.food),
    places: clean(extracted.places),
    healthMentions: clean(extracted.health_mentions),
    highlights: clean(extracted.highlights, 5),
    difficultMoments: clean(extracted.difficult_moments, 5),
    thingsToRemember: clean(extracted.things_to_remember, 5),
    summary: extracted.summary?.trim() || caller.slice(0, 200),
    journal: extracted.journal?.trim() || caller,
    transcript: turns.map((turn) => `${turn.speaker === "you" ? "You" : "VENT"}: ${turn.text}`).join("\n"),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Writing a page is three steps — draft (Gemma extraction), embed, save — so the
 * optional Temporal workflow (src/temporal) can run each one as a retried activity.
 * The direct path below composes the same steps in order.
 */
export async function draftEntry(turns: CallTurn[], date: string, keepTranscript: boolean) {
  const spoken = turns.filter((turn) => turn.text.trim());
  const extracted = await extractDay(spoken, displayDateFor(date));
  const entry = entryFromExtraction(extracted, spoken, date);
  if (!keepTranscript) delete entry.transcript;
  return entry;
}

export const embedEntry = (entry: JournalEntry) => embed(pageText(entry));

export const saveEntry = (entry: JournalEntry, embedding: number[] | undefined) => getStore().save({ ...entry, embedding });

export async function createEntryFromCall(turns: CallTurn[], date: string, keepTranscript: boolean) {
  const entry = await draftEntry(turns, date, keepTranscript);
  await saveEntry(entry, await embedEntry(entry));
  return entry;
}

const stopWords = new Set(["what", "when", "where", "which", "have", "with", "this", "that", "about", "did", "was", "were", "the", "and", "my", "me", "i", "a", "an", "of", "to", "in", "on", "how", "do", "does", "last", "show", "days", "day"]);

function keywordScore(question: string, entry: JournalEntry) {
  const haystack = pageText(entry).toLowerCase();
  return question.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)
    .filter((token) => token.length > 2 && !stopWords.has(token))
    .reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

export async function askJournal(question: string, today: string): Promise<MemoryAnswer & { dates: Array<{ id: string; displayDate: string }> }> {
  const store = getStore();
  const all = await store.list();
  if (!all.length) return { answer: "Your journal is still empty. Once you've talked through a day, you can ask about it here.", entryIds: [], dates: [] };

  // Small journals fit entirely in context; larger ones are narrowed by meaning + keywords + recency.
  let pages = all;
  if (all.length > 30) {
    const vector = await embed(question);
    const semantic = vector ? await store.nearest(vector, 12) : [];
    const keyword = [...all].sort((a, b) => keywordScore(question, b) - keywordScore(question, a)).slice(0, 10);
    const ids = new Set([...semantic, ...keyword, ...all.slice(0, 8)].map((entry) => entry.id));
    pages = all.filter((entry) => ids.has(entry.id));
  }

  const text = pages.map((entry) => `[id: ${entry.id}] ${pageText(entry)}`).join("\n");
  const { answer, entryIds } = await answerQuestion(question, text, today);
  const used = entryIds.map((id) => pages.find((entry) => entry.id === id)).filter((entry): entry is JournalEntry => Boolean(entry));
  return {
    answer: answer || "I couldn't find that in your journal.",
    entryIds: used.map((entry) => entry.id),
    dates: used.map((entry) => ({ id: entry.id, displayDate: entry.displayDate })),
  };
}
