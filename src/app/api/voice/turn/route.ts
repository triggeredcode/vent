import { NextResponse } from "next/server";
import { listen, transcribeAudio } from "@/lib/ollama";
import { traced } from "@/lib/telemetry";
import type { CallMode, CallTurn } from "@/lib/types";

export const maxDuration = 60;

const words = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);

/** A short "turn" made only of words Haan just said is its own voice leaking back through the speakers. */
function isEcho(transcript: string, history: CallTurn[]) {
  const lastVent = [...history].reverse().find((turn) => turn.speaker === "vent" && turn.text);
  if (!lastVent) return false;
  const heard = words(transcript);
  const said = new Set(words(lastVent.text));
  return heard.length > 0 && heard.length <= 4 && heard.every((word) => said.has(word));
}

export async function POST(request: Request) {
  const body = await request.json() as { audio?: string; format?: "wav" | "mp3"; mode?: CallMode; history?: CallTurn[] };
  if (!body.audio) return NextResponse.json({ error: "Audio is required." }, { status: 400 });
  const mode: CallMode = body.mode === "journal" ? "journal" : "vent";

  try {
    return await traced("voice-turn", "gen_ai.invoke_agent", { "gen_ai.agent.name": `vent-${mode}` }, async () => {
      const startedAt = performance.now();
      const transcript = await transcribeAudio(body.audio!, body.format ?? "wav");
      const heardAt = performance.now();
      if (!transcript || isEcho(transcript, body.history ?? [])) return NextResponse.json({ transcript: "", action: "silence", text: "" });
      const history = [...(body.history ?? []).slice(-16), { speaker: "you" as const, text: transcript }];
      const reply = await listen(history, mode);
      return NextResponse.json({
        transcript,
        ...reply,
        timings: { transcriptionMs: Math.round(heardAt - startedAt), responseMs: Math.round(performance.now() - heardAt) },
      });
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Voice turn failed" }, { status: 503 });
  }
}
