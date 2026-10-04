import { NextResponse } from "next/server";
import { embed } from "@/lib/ollama";
import { displayDateFor, moodFor } from "@/lib/mood";
import { getStore, pageText } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

export const maxDuration = 120;

/** Restores pages from a VENT export (GET /api/journal) or the bundled sample days. */
export async function POST(request: Request) {
  const body = await request.json() as { entries?: Array<Partial<JournalEntry> & { moodScore?: number }> };
  const store = getStore();
  let imported = 0;
  for (const raw of body.entries ?? []) {
    if (!raw.date || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date) || !raw.summary) continue;
    const mood = moodFor(raw.mood?.score ?? raw.moodScore ?? 3);
    const entry: JournalEntry = {
      id: raw.id ?? `${raw.date}-${Math.random().toString(36).slice(2, 8)}`,
      date: raw.date,
      displayDate: displayDateFor(raw.date),
      title: raw.title ?? "A day worth keeping",
      mood: { score: mood.score, label: mood.label, color: mood.color },
      moodArc: raw.moodArc ?? [],
      people: raw.people ?? [],
      food: raw.food ?? [],
      places: raw.places ?? [],
      healthMentions: raw.healthMentions ?? [],
      highlights: raw.highlights ?? [],
      difficultMoments: raw.difficultMoments ?? [],
      thingsToRemember: raw.thingsToRemember ?? [],
      summary: raw.summary,
      journal: raw.journal ?? raw.summary,
      transcript: raw.transcript,
      createdAt: raw.createdAt ?? new Date(`${raw.date}T21:00:00`).toISOString(),
    };
    await store.save({ ...entry, embedding: await embed(pageText(entry)) });
    imported += 1;
  }
  return NextResponse.json({ imported, storage: store.kind });
}
