import { NextResponse } from "next/server";
import { listenAndRespond, listenerModel } from "@/lib/ollama";

export async function POST(request: Request) {
  const body = await request.json() as { message?: string; mode?: "vent" | "journal" };
  const message = body.message?.trim() ?? "";
  if (!message) return NextResponse.json({ action: "silence", text: "" });

  try {
    return NextResponse.json({ ...await listenAndRespond(message, body.mode ?? "vent"), source: listenerModel() });
  } catch {
    return NextResponse.json({ error: "Ollama is unavailable." }, { status: 503 });
  }
}
