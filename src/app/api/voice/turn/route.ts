import { NextResponse } from "next/server";
import { listenAndRespond, transcribeAudio } from "@/lib/ollama";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { audio?: string; format?: "wav" | "mp3"; mode?: "vent" | "journal" };
    if (!body.audio) return NextResponse.json({ error: "Audio is required." }, { status: 400 });
    const transcript = await transcribeAudio(body.audio, body.format ?? "wav");
    if (!transcript) return NextResponse.json({ transcript: "", action: "silence", text: "" });
    const reply = await listenAndRespond(transcript, body.mode ?? "vent");
    return NextResponse.json({ transcript, ...reply, source: "ollama" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Voice turn failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
