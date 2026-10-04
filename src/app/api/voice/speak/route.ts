import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json() as { text?: string };
  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: "Text is required." }, { status: 400 });

  const baseUrl = process.env.VENT_TTS_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) return NextResponse.json({ error: "Custom voice service is not configured." }, { status: 503 });

  try {
    const response = await fetch(`${baseUrl}/v1/audio/speech`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: process.env.VENT_TTS_MODEL ?? "openvoice-v2",
        voice: process.env.VENT_TTS_VOICE ?? "vent-calm",
        input: text,
        response_format: "mp3",
        speed: 0.96,
      }),
    });
    if (!response.ok || !response.body) throw new Error(`Voice service failed (${response.status})`);
    return new Response(response.body, {
      headers: {
        "content-type": response.headers.get("content-type") ?? "audio/mpeg",
        "cache-control": "no-store",
        "x-vent-voice": process.env.VENT_TTS_VOICE ?? "vent-calm",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Voice synthesis failed." }, { status: 503 });
  }
}
