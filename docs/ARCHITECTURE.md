# Architecture

## Product flow

VENT is organized around one demo story: **Vent → Journal → Memory**.

The UI is a single mobile-shaped client experience so the call, generated journal, and memory answer feel continuous. The server surface stays deliberately small: provider credentials and local model calls belong in route handlers; private journal state currently stays in the browser.

## Runtime boundaries

### Client

- `src/components/vent-app.tsx` owns navigation and the end-to-end demo flow.
- Web Audio captures mono PCM, detects a completed voice turn, and encodes a 16 kHz WAV.
- Browser speech synthesis plays short listener responses.
- Journal entries persist in `localStorage` under `vent-journal`.
- `src/lib/journal.ts` contains deterministic extraction and grounded retrieval fallbacks.

### Server

- `GET /api/voice/status` verifies that Ollama and both required models are available before the UI claims to listen.
- `POST /api/voice/turn` accepts a WAV turn, uses `gemma4:e2b` for transcription, then asks `gemma3:4b` for one constrained listener action and a short response.
- `POST /api/listener` remains as the text-only listener adapter.
- Ollama defaults to `http://127.0.0.1:11434`; the call surfaces a quiet actionable error rather than silently switching to demo behavior.
- Serious self-harm language bypasses passive listening and receives a direct safety-oriented response.

## Listener contract

The model chooses among:

```text
silence
acknowledge
follow_up
clarify
reflect_briefly
```

VENT does not default to advice. Responses stay short enough to feel like a person listening on a call.

The same action drives the mascot’s gesture. Acknowledgments nod, questions tilt with curiosity, and brief reflections use a slower reassuring motion. This keeps animation deterministic without introducing a second model.

## Data boundary

The current MVP stores structured entries on the device only. A production backend should preserve the same adapter boundary:

```text
JournalStore
  ├── LocalJournalStore (current)
  └── MongoJournalStore (future)
```

Search must always return the dates used and must say when the journal does not contain an answer.

## Safety and privacy

- Vent calls are discarded when they end.
- Journal calls save a structured entry and optional transcript locally.
- No medical claims, diagnosis, medication guidance, or therapist positioning.
- Provider integrations must be opt-in and documented before private text leaves the device.

## Change order

Future work should follow dependency direction:

1. Stable journal schema and extraction evaluation.
2. Storage adapter and edit/delete controls.
3. Retrieval over verified structured entries.
4. Provider voice and observability integrations.
5. Deployment and submission assets.

This keeps the core story runnable after every milestone.
