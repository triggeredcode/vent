import { NextResponse } from "next/server";

type Action = "silence" | "acknowledge" | "follow_up" | "clarify" | "reflect_briefly";

const fallback = (message: string): { action: Action; text: string } => {
  const lower = message.toLowerCase();
  if (/kill myself|suicide|end my life|hurt myself/.test(lower)) {
    return { action: "reflect_briefly", text: "I'm really glad you said that out loud. Please contact local emergency support or someone you trust who can stay with you right now." };
  }
  if (message.length < 30) return { action: "acknowledge", text: "Hmm… I'm here." };
  if (/then|after|later|phir/.test(lower)) return { action: "follow_up", text: "And what happened after that?" };
  return { action: "reflect_briefly", text: "Yeah… that sounds like a lot to carry." };
};

export async function POST(request: Request) {
  const body = await request.json() as { message?: string; mode?: "vent" | "journal" };
  const message = body.message?.trim() ?? "";
  if (!message) return NextResponse.json({ action: "silence", text: "" });

  const baseUrl = process.env.OLLAMA_BASE_URL;
  const model = process.env.OLLAMA_MODEL ?? "gemma3:4b";
  if (!baseUrl) return NextResponse.json({ ...fallback(message), source: "local-fallback" });

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: "You are VENT, a restrained listener, not a therapist. Choose one action: silence, acknowledge, follow_up, clarify, reflect_briefly. Avoid advice. Reply as JSON with action and a natural response under 12 words. Hinglish is welcome when the user uses it." },
          { role: "user", content: message },
        ],
      }),
    });
    if (!response.ok) throw new Error("Ollama request failed");
    const data = await response.json() as { message?: { content?: string } };
    const parsed = JSON.parse(data.message?.content ?? "{}") as { action?: Action; text?: string; response?: string };
    return NextResponse.json({ action: parsed.action ?? "acknowledge", text: parsed.text ?? parsed.response ?? "Hmm…", source: model });
  } catch {
    return NextResponse.json({ ...fallback(message), source: "local-fallback" });
  }
}
