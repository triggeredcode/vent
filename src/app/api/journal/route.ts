import { NextResponse } from "next/server";
import { createEntryFromCall } from "@/lib/journal";
import { localDate } from "@/lib/mood";
import { getStore } from "@/lib/store";
import type { CallTurn } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  const store = getStore();
  return NextResponse.json({ entries: await store.list(), storage: store.kind });
}

export async function POST(request: Request) {
  const body = await request.json() as { turns?: CallTurn[]; date?: string; keepTranscript?: boolean };
  const turns = (body.turns ?? []).filter((turn) => turn.text?.trim());
  if (!turns.some((turn) => turn.speaker === "you")) return NextResponse.json({ error: "Nothing was said on this call." }, { status: 400 });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date ?? "") ? body.date! : localDate();

  try {
    return NextResponse.json({ entry: await createEntryFromCall(turns, date, body.keepTranscript !== false) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not write the page." }, { status: 503 });
  }
}
