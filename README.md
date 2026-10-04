# VENT

VENT is a private AI you can call when you just need to talk. It listens without trying to fix you, turns journal conversations into a visual record of your days, and lets you search what you have shared later.

The core loop is intentionally small:

> Call → talk naturally → end the call → see your day → ask your life

Open-weight AI is central to the listener: the included adapter runs Gemma through a local Ollama endpoint, keeping intimate conversations under the user’s control. A deterministic fallback keeps the demo functional when Ollama is unavailable.

## What works

- A polished mobile-first home and call experience
- Vent mode that does not save the conversation
- Journal mode that creates and saves a structured day locally
- Browser speech recognition with a typed demo fallback
- Short, restrained voice responses through browser speech synthesis
- Gemma listener adapter through Ollama
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

The app works without environment variables. To use a local open-weight model:

```bash
ollama pull gemma3:4b
ollama serve
```

Then set:

```dotenv
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=gemma3:4b
```

## Validate

```bash
pnpm lint
pnpm build
```

The build script uses webpack because it is more reliable in restricted CI and agent sandboxes. Development still uses the fast Next.js dev server.

## Architecture

```text
microphone / typed demo line
        ↓
browser speech recognition
        ↓
/api/listener → Gemma via Ollama → restrained action + short response
        ↓                         ↘ deterministic offline fallback
browser speech synthesis

journal call → structured entry → local browser storage
                                  ↓
                          calendar + day view
                                  ↓
                      grounded memory search
```


## Product boundaries

VENT is not a therapist, diagnosis tool, medical service, generic assistant, or productivity coach. It avoids unsolicited advice. If a person expresses an immediate safety crisis, passive-listener behavior is overridden with a direct safety-oriented response.

## Status


## License

MIT
