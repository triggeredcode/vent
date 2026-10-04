# VENT

**A friend you can call when you just need to talk.** VENT listens without trying to fix you, turns the days you talk through into a visual journal, and lets you ask about your own life later.

> Call → talk it out → see your day → ask your life

Every piece of intelligence in VENT is an open-weight model running on your own machine: these are the most private conversations a person has, so they shouldn't have to leave it.

## What it does

- **Vent** — a real phone call. VENT reacts like a friend would ("Wait, he blamed *you*?"), nudges you on, stays quiet when you're mid-thought, and never gives advice. When you hang up, nothing is kept unless you ask.
- **Journal** — tell VENT about your day. When the call ends, Gemma writes a magazine-style page: mood arc, people, food, places, highlights, hard moments, things to remember, and the day retold in your own words.
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
| VENT's voice | Kokoro-82M by default; Chatterbox-Turbo (MIT) clones *your* voice once you record one | `./voice`, local |

Measured warm on an M4 Pro: ~150–400 ms to transcribe a turn, ~400–550 ms to reply, then speech synthesis. The first reply is pre-warmed while the phone rings.

## Run it

Requirements: macOS on Apple Silicon (for the local voice), Node.js 20+, pnpm, [Ollama](https://ollama.com), and [uv](https://docs.astral.sh/uv/).

```bash
pnpm install
pnpm vent
```

`pnpm vent` does the rest: it starts Ollama and pulls the Gemma models on first run, starts VENT's local voice, starts the app, loads a few sample days into an empty journal and opens http://localhost:3000.

Use Chrome or Safari (the microphone needs `localhost`). Laptop speakers are fine: VENT never listens while it talks. Tap the character to interrupt it.

### Give VENT your own voice (optional, ~2 minutes)

Out of the box VENT speaks with Kokoro's `af_heart`, a natural local voice. You can make it talk in **your** voice, or a friend's if they agree:

1. **Record.** Run `pnpm voice:record`. It shows a short script (`voice/SCRIPT.md`), counts down and records 45 seconds. Just read it like you're talking to a friend.
2. **It cleans the take.** It trims the silences, removes low rumble and evens out the loudness.
3. **It switches the voice.** The voice server restarts and clones your voice locally with Chatterbox-Turbo (MIT), at about 0.5 s per line on Apple Silicon. The first time, it downloads the cloning model (~1.2 GB).
4. **Optional, ElevenLabs.** `pnpm connect` can clone the same recording on your ElevenLabs account, so the voice also works through ElevenLabs Flash.

Your recording stays in `voice/voices/`, which is gitignored and never committed. To go back to the default voice, delete that folder and run `pnpm vent`.

Tips for a clean result: use a quiet room, no fan or music, sit about a hand's width from the mic, and talk calmly.

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

## Durable journal writing (Temporal)

Writing the page after a call is a three-step pipeline running on a laptop: Gemma drafts the day (slow, and it can time out while a model loads), `nomic-embed-text` embeds it, and the page is saved. `POST /api/journal` runs these steps as the Temporal workflow `writeJournalPage`, so a page is never lost:

- **Retries:** each step is an activity with its own timeout and retry policy. Drafting gets 3 min per try and up to 5 tries with backoff, and it heartbeats so a dead worker is noticed within ~20 s. "Nothing was said" fails fast without retrying.
- **Resuming:** the call's turns are the workflow input, so if Ollama hiccups or the worker restarts mid-way, Temporal resumes from the last finished step.
- **No duplicates:** the workflow id comes from the request (or a hash of the call), so tapping "Try again" joins the same run instead of writing a second page.

`pnpm vent` installs the Temporal CLI on first run (via Homebrew), then starts the dev server (`:7233`) and the worker (`pnpm worker`, task queue `vent-journal`). Watch each page being written and retried at http://localhost:8233. If Temporal is ever unreachable, the app logs it and writes the page directly. Set `TEMPORAL_ADDRESS=off` to skip Temporal entirely.

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
