# Production readiness

## What runs today, on one machine

1. Browser microphone capture and voice-activity detection.
2. Gemma 4 E2B transcription and Gemma 4 E4B listening, through local Ollama.
3. A local open-weight voice (Kokoro-82M) behind an OpenAI-compatible `/v1/audio/speech` server in `./voice`.
4. Gemma-written journal pages and grounded memory answers.
5. Pages in a local JSON store, or MongoDB Atlas with vector search.

This is a complete private product for one person on one machine. It is not yet a multi-user service.

## Latency budget (M4 Pro, warm)

| Stage | Today | Production target |
| --- | ---: | ---: |
| End-of-turn detection | ~470 ms | 250–350 ms with a learned turn detector |
| Transcription (Gemma 4 E2B) | 150–400 ms | 100–300 ms streaming ASR |
| Listener reply (Gemma 4 E4B) | 400–550 ms | 200–400 ms |
| First voice audio (Kokoro) | see `voice/README.md` | <200 ms streaming |

The listener's system prompt is pre-filled while the phone rings, so the first turn isn't slower than the rest.

## Local limits

- Two Gemma models stay resident (~17 GB unified memory). Smaller machines can set `OLLAMA_LISTENER_MODEL=gemma4:e2b` (faster, plainer replies).
- One conversation at a time per GPU.
- Browser-only microphone, so no phone-network calling or background calls.
- No accounts or encryption at rest for the local file store. Disk encryption is the boundary.

## Production path

1. User-scoped, encrypted storage (Atlas with per-user keys) and account recovery.
2. A realtime transport (WebRTC) with streaming ASR and streaming TTS; keep the listener action contract and the mascot gesture mapping unchanged.
3. Learned end-of-turn detection and proper acoustic echo cancellation for speaker-phone barge-in.
4. Sentry dashboards on turn latency percentiles, plus alerts on transcription/extraction failures (already instrumented).
5. A reviewed crisis policy with qualified specialists before inviting anyone beyond friends.
6. A fine-tuned listener only if real sessions show a measurable gap (unsolicited-advice rate, reply length, interruption rate).

## Integrations

| Integration | Role in VENT | How it's enabled |
| --- | --- | --- |
| Gemma (Ollama) | All model work: hearing, replying, journal writing, memory | Always (local) |
| Temporal | Durable, retried journal writing after every call | On by default (`pnpm vent`) |
| MongoDB Atlas | Synced journal + Atlas Vector Search for memory | `MONGODB_URI` |
| Sentry | `gen_ai` traces of every call turn, no content | `pnpm connect` |
| ElevenLabs | Your cloned voice and studio punch sound effects | `pnpm connect` |
