import { NextResponse } from "next/server";
import { asFlavor, synthesize, voiceProvider } from "@/lib/voice";

export const maxDuration = 30;

export async function POST(request: Request) {
  const body = await request.json() as { text?: string; flavor?: string };
  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: "Text is required." }, { status: 400 });

  try {
    const response = await synthesize(text, asFlavor(body.flavor));
    if (!response.ok || !response.body) throw new Error(`Voice service failed (${response.status})`);
    return new Response(response.body, {
      headers: {
        "content-type": response.headers.get("content-type") ?? "audio/wav",
        "cache-control": "no-store",
        "x-vent-voice": voiceProvider(),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Voice synthesis failed." }, { status: 503 });
  }
}
