import { traced } from "./telemetry";

export type VoiceProvider = "local" | "elevenlabs";

export function voiceProvider(): VoiceProvider {
  return process.env.VENT_VOICE_PROVIDER === "elevenlabs" && process.env.ELEVENLABS_API_KEY ? "elevenlabs" : "local";
}

const localBase = () => (process.env.VENT_TTS_BASE_URL ?? "http://127.0.0.1:8880").replace(/\/$/, "");

export async function voiceStatus() {
  const provider = voiceProvider();
  if (provider === "elevenlabs") return { provider, ready: true };
  try {
    const response = await fetch(`${localBase()}/health`, { cache: "no-store", signal: AbortSignal.timeout(2_000) });
    return { provider, ready: response.ok };
  } catch {
    return { provider, ready: false };
  }
}

/** Returns a streaming audio response from the configured voice. */
export async function synthesize(text: string): Promise<Response> {
  const provider = voiceProvider();
  return traced("speak", "gen_ai.speech", { "vent.voice_provider": provider, "vent.characters": text.length }, async () => {
    if (provider === "elevenlabs") {
      const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
      return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128&optimize_streaming_latency=3`, {
        method: "POST",
        headers: { "content-type": "application/json", "xi-api-key": process.env.ELEVENLABS_API_KEY! },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({
          text,
          model_id: process.env.ELEVENLABS_MODEL ?? "eleven_flash_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, speed: 0.95 },
        }),
      });
    }
    return fetch(`${localBase()}/v1/audio/speech`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        model: process.env.VENT_TTS_MODEL ?? "kokoro",
        voice: process.env.VENT_TTS_VOICE ?? "default",
        input: text,
        response_format: "wav",
        speed: Number(process.env.VENT_TTS_SPEED ?? 1),
      }),
    });
  });
}
