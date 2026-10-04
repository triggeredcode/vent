# VENT

VENT is a private AI you can call when you just need to talk. It listens without trying to fix you, turns journal conversations into a visual record of your days, and lets you search what you have shared later.

The core loop is intentionally small:

> Call → talk naturally → end the call → see your day → ask your life

Open-weight AI is central to the listener: Gemma transcribes and responds through local Ollama, keeping intimate conversations on the user’s machine.

## What works

- A polished, iOS-inspired call experience with connecting, ringing, and pickup states
- An animated 3D listener whose motion follows the model’s response action
- Vent mode that does not save the conversation
- Journal mode that creates and saves a structured day locally
- Real microphone PCM capture and local Gemma audio transcription
- Short, restrained voice responses through browser speech synthesis
- Ollama health checks that prevent false “Listening” states
- Mood calendar and detailed daily journal
- Grounded search over saved entries with source dates
- Local browser persistence and a PWA manifest
- Crisis-language override without positioning VENT as therapy

## Run locally

Requirements: Node.js 20+ and pnpm 11+.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

The local voice call defaults to Ollama at `http://127.0.0.1:11434`. Install both models:

```bash
ollama pull gemma3:1b
ollama pull gemma4:e2b
ollama serve
```

Then set:

```dotenv
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=gemma3:1b
OLLAMA_AUDIO_MODEL=gemma4:e2b
VENT_TTS_BASE_URL=http://127.0.0.1:8880
VENT_TTS_MODEL=openvoice-v2
VENT_TTS_VOICE=vent-calm
```

## Validate

```bash
pnpm lint
pnpm build
```

The build script uses webpack because it is more reliable in restricted CI and agent sandboxes. Development still uses the fast Next.js dev server.

## Architecture

```text
microphone
        ↓
browser PCM capture → 16 kHz WAV
        ↓
/api/voice/turn → Gemma 4 audio transcription → Gemma 3 listener action
        ↓
browser speech synthesis

journal call → structured entry → local browser storage
                                  ↓
                          calendar + day view
                                  ↓
                      grounded memory search
```


See [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) for the measured latency budget, custom voice requirements, local limits, and production path.

## Product boundaries

VENT is not a therapist, diagnosis tool, medical service, generic assistant, or productivity coach. It avoids unsolicited advice. If a person expresses an immediate safety crisis, passive-listener behavior is overridden with a direct safety-oriented response.

## Status


## License

MIT
