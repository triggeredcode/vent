import { NextResponse } from "next/server";
import { askJournal } from "@/lib/journal";
import { displayDateFor, localDate } from "@/lib/mood";

export const maxDuration = 90;

export async function POST(request: Request) {
  const body = await request.json() as { question?: string; today?: string };
  const question = body.question?.trim();
  if (!question) return NextResponse.json({ error: "Ask a question." }, { status: 400 });
  const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today ?? "") ? body.today! : localDate();

  try {
    return NextResponse.json(await askJournal(question, `${displayDateFor(today)} ${today.slice(0, 4)}`));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Memory is unavailable." }, { status: 503 });
  }
}
