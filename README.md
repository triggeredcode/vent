# VENT

**A friend you can call when you just need to talk.** VENT listens without trying to fix you, turns the days you talk through into a visual journal, and lets you ask about your own life later.

> Call → talk it out → see your day → ask your life

Every piece of intelligence in VENT is an open-weight model running on your own machine: these are the most private conversations a person has, so they shouldn't have to leave it.

## What it does

- **Vent** — a real phone call. VENT reacts like a friend would ("Wait, he blamed *you*?"), nudges you on, stays quiet when you're mid-thought, and never gives advice. When you hang up, nothing is kept unless you ask.
- **Journal** — tell VENT about your day. When the call ends, Gemma writes a magazine-style page: mood arc, people, food, places, highlights, hard moments, things to remember, and the day retold in your own voice.
- **Memories** — ask "When did I last mention Rahul?" or "What did I eat last Sunday?" and get an answer grounded only in your pages, with the days it came from.
- **Let it out your way.** Pick a mode on the Talk it out card. Each one is its own world with its own character:
  - **Breathe** (default): Puff, a cloud spirit, breathes with you on a pastel aurora, and VENT stays calm.
  - **Punch** (devil mode): a furious little devil boxer throws a punch whenever *your voice* gets loud. The bag wears down and bursts every 20 hits, with real impact sounds, and VENT gets fired up on your side.
  Gemma reads the mood of each line (fired up, heavy, tense, bright, calm) and the scene's colours follow.
- **Let it go.** Hang up on a vent and the call's page dissolves into drifting specks. Nothing is kept.
- Edit or delete any page, or forget its recording and keep the page.

## Open models at the core

| Job | Model | Where |
| --- | --- | --- |
| Hear each turn (speech → text) | Gemma 4 E2B | Ollama, local |
| Reply on the call | Gemma 4 E4B | Ollama, local |
| Write the journal page (JSON schema) | Gemma 4 E4B | Ollama, local |
| Answer memory questions | Gemma 4 E4B | Ollama, local |
| Embeddings for memory search | nomic-embed-text | Ollama, local |
| VENT's voice | Chatterbox-Turbo (your cloned voice, MIT), Kokoro-82M fallback | `./voice`, local |

Measured warm on an M4 Pro: ~150–400 ms to transcribe a turn, ~400–550 ms to reply, then speech synthesis. The first reply is pre-warmed while the phone rings.

## Run it

Requirements: macOS on Apple Silicon (for the local voice), Node.js 20+, pnpm, [Ollama](https://ollama.com), and [uv](https://docs.astral.sh/uv/).

```bash
pnpm install
pnpm vent
```

`pnpm vent` does the rest: it starts Ollama and pulls the Gemma models on first run, starts VENT's local voice, starts the app, loads a few sample days into an empty journal and opens http://localhost:3000.

Use Chrome or Safari (the microphone needs `localhost`). Laptop speakers are fine: VENT never listens while it talks. Tap the character to interrupt it.

### Partners in one command

```bash
pnpm connect
```

This walks you through Sentry and ElevenLabs. It opens the right pages, checks each key for real (it sends Sentry a test event), clones your voice on ElevenLabs from your recording, generates the punch-mode sound effects, and writes everything to `.env.local`. Then run `pnpm vent` again.

## Optional partner integrations

All of these are off by default and switched on by environment variables (see `.env.example`). Nothing private leaves the machine unless you turn one on.

- **MongoDB Atlas:** set `MONGODB_URI` to keep pages in Atlas. VENT creates an Atlas Vector Search index and retrieves pages by meaning, using embeddings computed locally. Works with Atlas cloud or `mongodb/mongodb-atlas-local`.
- **Sentry:** set `SENTRY_DSN` to trace every call turn (`voice-turn` → `transcribe` → `listen` → `speak`), plus journal writing and memory answers, as `gen_ai` spans with latency and token counts. Content collection is fully disabled.
- **ElevenLabs:** `pnpm connect` clones your voice on ElevenLabs (Instant Voice Clone from your own recording), generates the punch-mode sound effects with the Sound Effects API, and can make Flash v2.5 VENT's streaming voice, with per-mode delivery (calm, fired, bright). Only VENT's replies are sent, never your microphone.

## Validate

```bash
pnpm lint
pnpm build
```

## Design notes

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): pipeline, turn-taking, storage and tracing boundaries.
- [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md): latency budget, local limits, production path.

## Boundaries

VENT is not a therapist, diagnosis tool, medical service, or productivity coach. It doesn't give unsolicited advice. If someone expresses an immediate safety crisis, VENT stops being a passive listener and points to real help (local emergency services, findahelpline.com).

## License

MIT
