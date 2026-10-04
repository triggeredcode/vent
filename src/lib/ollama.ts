export type ListenerAction = "silence" | "acknowledge" | "follow_up" | "clarify" | "reflect_briefly";

const baseUrl = () => (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
export const listenerModel = () => process.env.OLLAMA_MODEL ?? "gemma3:4b";
export const audioModel = () => process.env.OLLAMA_AUDIO_MODEL ?? "gemma4:e2b";

type OllamaTag = { name?: string; model?: string };

export async function getVoiceStatus() {
  try {
    const response = await fetch(`${baseUrl()}/api/tags`, { cache: "no-store", signal: AbortSignal.timeout(4_000) });
    if (!response.ok) throw new Error("Ollama did not respond");
    const data = await response.json() as { models?: OllamaTag[] };
    const names = new Set((data.models ?? []).flatMap((item) => [item.name, item.model]).filter(Boolean));
    const missing = [listenerModel(), audioModel()].filter((model) => !names.has(model));
    return { ready: missing.length === 0, missing };
  } catch {
    return { ready: false, missing: [listenerModel(), audioModel()] };
  }
}

export async function transcribeAudio(audio: string, format: "wav" | "mp3" = "wav") {
  const response = await fetch(`${baseUrl()}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: audioModel(),
      temperature: 0,
      max_tokens: 220,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Transcribe this recording verbatim. Keep the speaker's language, including Hinglish. Return only the transcript." },
          { type: "input_audio", input_audio: { data: audio, format } },
        ],
      }],
    }),
  });
  if (!response.ok) throw new Error(`Audio model failed (${response.status})`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return (data.choices?.[0]?.message?.content ?? "").trim().replace(/^['\"]|['\"]$/g, "");
}

const safeFallback = (message: string): { action: ListenerAction; text: string } => {
  if (/kill myself|suicide|end my life|hurt myself/i.test(message)) {
    return { action: "reflect_briefly", text: "I'm glad you said that. Please reach someone who can stay with you now." };
  }
  return { action: "acknowledge", text: "I'm here. Take your time." };
};

export async function listenAndRespond(message: string, mode: "vent" | "journal") {
  const response = await fetch(`${baseUrl()}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model: listenerModel(),
      stream: false,
      format: "json",
      options: { temperature: 0.35 },
      messages: [
        {
          role: "system",
          content: `You are VENT, a warm, restrained listener in a ${mode} voice call. You are not a therapist. Respond naturally in the speaker's language. Avoid advice and diagnosis. Ask at most one gentle question. Return JSON with action (silence, acknowledge, follow_up, clarify, or reflect_briefly) and text. Keep text under 16 words.`,
        },
        { role: "user", content: message },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Listener model failed (${response.status})`);
  const data = await response.json() as { message?: { content?: string } };
  try {
    const parsed = JSON.parse(data.message?.content ?? "{}") as { action?: ListenerAction; text?: string; response?: string };
    return { action: parsed.action ?? "acknowledge", text: parsed.text ?? parsed.response ?? "I'm here." };
  } catch {
    return safeFallback(message);
  }
}
