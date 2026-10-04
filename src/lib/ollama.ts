import { crisisPattern, crisisResponse, extractionPrompt, listenerSystemPrompt, memoryPrompt, transcriptionPrompt } from "./prompts";
import { recordUsage, traced } from "./telemetry";
import type { CallMode, CallTurn, ListenerAction, ListenerTone } from "./types";

const baseUrl = () => (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
/** Fast ears: transcribes each spoken turn. */
export const voiceModel = () => process.env.OLLAMA_VOICE_MODEL ?? "gemma4:e2b";
/** The listener's voice on the call. */
export const listenerModel = () => process.env.OLLAMA_LISTENER_MODEL ?? "gemma4:e4b";
/** After the call: journal extraction and memory answers. */
export const journalModel = () => process.env.OLLAMA_JOURNAL_MODEL ?? "gemma4:e4b";
export const embeddingModel = () => process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  format?: "json" | object;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  span: string;
}

async function chat({ model, messages, format, temperature = 0.4, maxTokens = 256, timeoutMs = 60_000, span }: ChatOptions) {
  return traced(span, "gen_ai.chat", { "gen_ai.request.model": model }, async (activeSpan) => {
    const startedAt = performance.now();
    const response = await fetch(`${baseUrl()}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model,
        messages,
        format,
        stream: false,
        think: false,
        keep_alive: "30m",
        options: { temperature, num_predict: maxTokens },
      }),
    });
    if (!response.ok) throw new Error(`${model} failed (${response.status})`);
    const data = await response.json() as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
    const ms = Math.round(performance.now() - startedAt);
    recordUsage(activeSpan, { model, inputTokens: data.prompt_eval_count, outputTokens: data.eval_count, ms });
    return { content: (data.message?.content ?? "").trim(), ms };
  });
}

function parseJson<T>(content: string): Partial<T> {
  try {
    return JSON.parse(content) as Partial<T>;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try { return JSON.parse(match[0]) as Partial<T>; } catch { return {}; }
  }
}

async function warm(model: string) {
  await fetch(`${baseUrl()}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({ model, prompt: "", stream: false, keep_alive: "30m" }),
  });
}

/** Loads the listener and pre-fills its system prompt so the first reply is as fast as the rest. */
async function primeListener(mode: CallMode) {
  await fetch(`${baseUrl()}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model: listenerModel(),
      messages: [{ role: "system", content: listenerSystemPrompt(mode) }, { role: "user", content: "hi" }],
      stream: false,
      think: false,
      keep_alive: "30m",
      options: { num_predict: 1 },
    }),
  });
}

export async function getModelStatus(mode?: CallMode) {
  try {
    const response = await fetch(`${baseUrl()}/api/tags`, { cache: "no-store", signal: AbortSignal.timeout(4_000) });
    if (!response.ok) throw new Error("Ollama did not respond");
    const data = await response.json() as { models?: Array<{ name?: string; model?: string }> };
    const names = new Set((data.models ?? []).flatMap((item) => [item.name, item.model]).filter(Boolean));
    const has = (model: string) => names.has(model) || names.has(`${model}:latest`);
    const required = [...new Set([voiceModel(), listenerModel(), journalModel(), embeddingModel()])];
    const missing = required.filter((model) => !has(model));
    const live = [...new Set([voiceModel(), listenerModel()])];
    // Both call models must be in memory before VENT "picks up"; the journal model can load later.
    await Promise.all(live.filter((model) => !missing.includes(model)).map((model) =>
      (model === listenerModel() && mode ? primeListener(mode) : warm(model)).catch(() => undefined)));
    if (!missing.includes(journalModel()) && !live.includes(journalModel())) void warm(journalModel()).catch(() => undefined);
    return { ready: live.every((model) => !missing.includes(model)), missing };
  } catch {
    return { ready: false, missing: [voiceModel(), listenerModel(), journalModel(), embeddingModel()] };
  }
}

export async function transcribeAudio(audio: string, format: "wav" | "mp3" = "wav") {
  return traced("transcribe", "gen_ai.chat", { "gen_ai.request.model": voiceModel() }, async (span) => {
    const startedAt = performance.now();
    const response = await fetch(`${baseUrl()}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: voiceModel(),
        temperature: 0,
        max_tokens: 160,
        reasoning_effort: "none",
        keep_alive: "30m",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: transcriptionPrompt },
            { type: "input_audio", input_audio: { data: audio, format } },
          ],
        }],
      }),
    });
    if (!response.ok) throw new Error(`Audio model failed (${response.status})`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    recordUsage(span, { model: voiceModel(), inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens, ms: Math.round(performance.now() - startedAt) });
    const text = (data.choices?.[0]?.message?.content ?? "").trim().replace(/^['"]|['"]$/g, "");
    // Gemma occasionally describes silence instead of returning nothing.
    if (/^(\[.*\]|\(.*\)|no speech.*|silence\.?)$/i.test(text)) return "";
    return text;
  });
}

const adviceSmell = /\b(you should|you could try|have you tried|try to|make sure to|it'?s important to|consider (talking|trying))\b/i;

const tones: ListenerTone[] = ["fired_up", "heavy", "tense", "bright", "calm"];

export async function listen(history: CallTurn[], mode: CallMode): Promise<{ action: ListenerAction; tone: ListenerTone; text: string }> {
  const latest = history.at(-1)?.text ?? "";
  if (crisisPattern.test(latest)) return { action: "reflect_briefly", tone: "heavy", text: crisisResponse };

  const messages: ChatMessage[] = [
    { role: "system", content: listenerSystemPrompt(mode) },
    ...history.slice(-16).map((turn): ChatMessage => turn.speaker === "you"
      ? { role: "user", content: turn.text }
      : { role: "assistant", content: JSON.stringify({ action: turn.action ?? (turn.text ? "acknowledge" : "silence"), text: turn.text }) }),
  ];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { content } = await chat({ model: listenerModel(), messages, format: "json", temperature: 0.7 + attempt * 0.15, maxTokens: 70, span: "listen" });
    const parsed = parseJson<{ action: ListenerAction; tone: ListenerTone; text: string }>(content);
    const text = (parsed.text ?? "").replace(/\s+/g, " ").trim();
    const action: ListenerAction = parsed.action && ["silence", "acknowledge", "follow_up", "clarify", "reflect_briefly"].includes(parsed.action) ? parsed.action : "acknowledge";
    const tone: ListenerTone = parsed.tone && tones.includes(parsed.tone) ? parsed.tone : "calm";
    if (action === "silence" || !text) return { action: "silence", tone, text: "" };
    if (adviceSmell.test(text) && attempt === 0) continue;
    return { action, tone, text };
  }
  return { action: "silence", tone: "calm", text: "" };
}

const stringList = { type: "array", items: { type: "string" } };
const journalSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    mood_score: { type: "integer", minimum: 1, maximum: 5 },
    mood_arc: {
      type: "array",
      items: { type: "object", properties: { phase: { type: "string" }, label: { type: "string" }, emoji: { type: "string" } }, required: ["phase", "label", "emoji"] },
    },
    people: stringList,
    food: stringList,
    places: stringList,
    health_mentions: stringList,
    highlights: stringList,
    difficult_moments: stringList,
    things_to_remember: stringList,
    summary: { type: "string" },
    journal: { type: "string" },
  },
  required: ["title", "mood_score", "mood_arc", "people", "food", "places", "health_mentions", "highlights", "difficult_moments", "things_to_remember", "summary", "journal"],
};

export interface ExtractedDay {
  title: string;
  mood_score: number;
  mood_arc: Array<{ phase: string; label: string; emoji: string }>;
  people: string[];
  food: string[];
  places: string[];
  health_mentions: string[];
  highlights: string[];
  difficult_moments: string[];
  things_to_remember: string[];
  summary: string;
  journal: string;
}

export async function extractDay(turns: CallTurn[], today: string): Promise<Partial<ExtractedDay>> {
  const conversation = turns.map((turn) => `${turn.speaker === "you" ? "CALLER" : "VENT"}: ${turn.text}`).join("\n");
  const { content } = await chat({
    model: journalModel(),
    messages: [
      { role: "system", content: extractionPrompt(today) },
      { role: "user", content: `Conversation:\n${conversation}` },
    ],
    format: journalSchema,
    temperature: 0.2,
    maxTokens: 900,
    timeoutMs: 120_000,
    span: "extract-journal",
  });
  return parseJson<ExtractedDay>(content);
}

export async function answerQuestion(question: string, pages: string, today: string) {
  const { content } = await chat({
    model: journalModel(),
    messages: [
      { role: "system", content: memoryPrompt(today) },
      { role: "user", content: `Journal pages:\n${pages}\n\nQuestion: ${question}` },
    ],
    format: "json",
    temperature: 0.2,
    maxTokens: 220,
    timeoutMs: 90_000,
    span: "answer-memory",
  });
  const parsed = parseJson<{ answer: string; entry_ids: string[] }>(content);
  return { answer: (parsed.answer ?? "").trim(), entryIds: Array.isArray(parsed.entry_ids) ? parsed.entry_ids.map(String) : [] };
}

export async function embed(text: string): Promise<number[] | undefined> {
  try {
    return await traced("embed", "gen_ai.embeddings", { "gen_ai.request.model": embeddingModel() }, async () => {
      const response = await fetch(`${baseUrl()}/api/embed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({ model: embeddingModel(), input: text, keep_alive: "30m" }),
      });
      if (!response.ok) return undefined;
      const data = await response.json() as { embeddings?: number[][] };
      return data.embeddings?.[0];
    });
  } catch {
    return undefined;
  }
}
