# Haan

*Haan* (हाँ) is the "haan… haan…" a friend says while they're listening. That's the whole product.

**A friend you can call when you just need to talk.** Haan listens without trying to fix you, turns the days you talk through into a visual journal, and lets you ask about your own life later.

> Call → talk it out → see your day → ask your life

Every piece of intelligence in Haan is an open-weight model running on your own machine: these are the most private conversations a person has, so they shouldn't have to leave it.

## What it does

- **Vent** — a real phone call. Haan reacts like a friend would ("Wait, he blamed *you*?"), nudges you on, stays quiet when you're mid-thought, and never gives advice. When you hang up, nothing is kept unless you ask.
- **Journal** — tell Haan about your day. When the call ends, Gemma writes a magazine-style page: mood arc, people, food, places, highlights, hard moments, things to remember, and the day retold in your own voice.
- **Memories** — ask "When did I last mention Rahul?" or "What did I eat last Sunday?" and get an answer grounded only in your pages, with the days it came from.
- English and Hinglish, both directions.
- Edit or delete any page, or forget its recording and keep the page.

## Open models at the core

| Job | Model | Where |
| --- | --- | --- |
| Hear each turn (speech → text) | Gemma 4 E2B | Ollama, local |
| Reply on the call | Gemma 4 E4B | Ollama, local |
| Write the journal page (JSON schema) | Gemma 4 E4B | Ollama, local |
| Answer memory questions | Gemma 4 E4B | Ollama, local |
| Embeddings for memory search | nomic-embed-text | Ollama, local |
| Haan's voice | Kokoro-82M | `./voice`, local |

Measured warm on an M4 Pro: ~150–400 ms to transcribe a turn, ~400–550 ms to reply, then speech synthesis. The first reply is pre-warmed while the phone rings.

## Run it

Requirements: Node.js 20+, pnpm, [Ollama](https://ollama.com), Python 3.12 + [uv](https://docs.astral.sh/uv/).

```bash
# 1. models
ollama pull gemma4:e2b
ollama pull gemma4:e4b
ollama pull nomic-embed-text

# 2. app
pnpm install
cp .env.example .env.local

# 3. Haan's voice (first run downloads the model)
pnpm voice

# 4. in another terminal
pnpm dev                # http://localhost:3000
pnpm seed               # optional: load eleven sample days
```

Use Chrome or Safari on `localhost` (microphone access needs a secure context). Laptop speakers are fine: Haan never listens while it is talking. Tap the mascot to interrupt it.

## Optional partner integrations

All of these are off by default and switched on by environment variables (see `.env.example`). Nothing private leaves the machine unless you turn one on.

- **MongoDB Atlas:** set `MONGODB_URI` to keep pages in Atlas. Haan creates an Atlas Vector Search index and retrieves pages by meaning, using embeddings computed locally. Works with Atlas cloud or `mongodb/mongodb-atlas-local`.
- **Sentry:** set `SENTRY_DSN` to trace every call turn (`voice-turn` → `transcribe` → `listen` → `speak`), plus journal writing and memory answers, as `gen_ai` spans with latency and token counts. Content collection is fully disabled.
- **ElevenLabs:** set `VENT_VOICE_PROVIDER=elevenlabs` and `ELEVENLABS_API_KEY` to swap the local voice for Flash v2.5 streaming. Only Haan's replies are sent, never your voice.

## Validate

```bash
pnpm lint
pnpm build
```

## Design notes

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): pipeline, turn-taking, storage and tracing boundaries.
- [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md): latency budget, local limits, production path.

## Boundaries

Haan is not a therapist, diagnosis tool, medical service, or productivity coach. It doesn't give unsolicited advice. If someone expresses an immediate safety crisis, Haan stops being a passive listener and points to real help (Tele-MANAS 14416 / 112 in India).

## License

MIT
