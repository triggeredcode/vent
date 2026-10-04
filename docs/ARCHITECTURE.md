# Architecture

## Product flow

VENT is organised around one story: **call → talk → see your day → ask your life**.

The UI is one phone-shaped client (`src/components/vent-app.tsx`) so the call, the page it produces, and later memory answers feel continuous. Every screen lives inside the same fixed-size shell; only the content area scrolls.

## The call

```text
microphone ─► Web Audio VAD (adaptive noise floor, ~470 ms end-of-turn)
           ─► 16 kHz WAV
           ─► POST /api/voice/turn
                 ├─ Gemma 4 E2B  : audio → transcript              (~150–400 ms warm)
                 └─ Gemma 4 E4B  : whole call so far → {action, text}  (~400–550 ms warm)
           ─► POST /api/voice/speak ─► Kokoro-82M (local) or ElevenLabs (opt-in)
           ─► speaker
```

Turn-taking rules live in `src/components/call-screen.tsx`:

- **Hold back:** if the caller starts talking again while VENT is thinking, the pending reply is dropped and the new audio is processed with the full history.
- **Barge-in:** if the caller clearly talks over VENT, playback stops and VENT listens.
- **Silence is an answer:** the listener may choose `silence` when a line is cut off mid-thought.
- **Warm pickup:** while the phone "rings", both models are loaded and the listener's system prompt is pre-filled, so the first reply is as fast as the rest.

### Listener contract

```text
silence | acknowledge | follow_up | clarify | reflect_briefly
```

The prompt (`src/lib/prompts.ts`) asks for short, specific, spoken reactions in the caller's language (English or Hinglish), never advice or therapy talk. Replies that smell like advice are regenerated once. The chosen action drives the mascot's gesture (nod, tilt, reassure, quiet nod).

Crisis language bypasses the model entirely and returns a direct safety response with Indian helplines.

## After the call

- **Vent call:** nothing is stored. The caller may choose "Keep it as a page".
- **Journal call:** `POST /api/journal` sends the turns to Gemma 4 E4B with a JSON schema (Ollama structured outputs). Only the caller's words count as facts. The page is embedded locally with `nomic-embed-text` and saved.

## Memory

`POST /api/memory` gives Gemma the user's pages (as compact text, never raw transcripts) and asks for `{answer, entry_ids}`. Ids that do not exist are discarded, so every cited day is real. When the journal grows past ~30 pages, candidates are narrowed by vector similarity + keywords + recency first.

## Storage boundary

```text
JournalStore (src/lib/store.ts)
  ├── LocalJournalStore  — .vent-data/journal.json (default, never leaves the machine)
  └── AtlasJournalStore  — MongoDB Atlas, $vectorSearch over the same local embeddings
```

`GET /api/journal` doubles as an export; `POST /api/journal/import` restores an export (and loads the sample days via `pnpm seed`).

## Observability

`src/instrumentation.ts` starts Sentry only when `SENTRY_DSN` is set. `src/lib/telemetry.ts` wraps each pipeline step (`voice-turn` → `transcribe`, `listen`; `extract-journal`; `answer-memory`; `embed`; `speak`) in `gen_ai.*` spans carrying model names, token counts and durations. All SDK data collection is disabled: no bodies, headers, prompts or outputs leave the machine.

## Safety and privacy

- Vent calls are discarded when they end unless the caller keeps them.
- Journal pages keep the transcript until the caller taps "Forget the recording".
- No medical claims, diagnosis, medication guidance, or therapist positioning.
- Every hosted provider (ElevenLabs, Atlas, Sentry) is opt-in through environment variables and documented in `.env.example`.
