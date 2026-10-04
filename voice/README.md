# VENT local voice (TTS)

A local text-to-speech server for VENT. It uses **Kokoro-82M** (Apache-2.0, hexgrad) and runs on the Apple Silicon GPU through
**mlx-audio** (`mlx-community/Kokoro-82M-bf16`). Text goes through **misaki**, the same G2P Kokoro was trained with.
Homebrew `espeak-ng` covers words misaki doesn't know and Hindi.

Why this engine: on an M4 Pro, MLX was about 3.5x faster than `kokoro-onnx` on CPU (148 ms vs 524 ms for the
same sentence). misaki's English pronunciation is also better than plain espeak.

## Start

```bash
./voice/start.sh        # foreground
./voice/start.sh --bg   # background, logs to voice/server.log, pid in voice/server.pid
curl -s http://127.0.0.1:8880/health
```

`start.sh` installs espeak-ng with brew if it's missing, runs `uv sync` (`.venv`), sets `HF_HOME=voice/.cache/huggingface`, and
starts the server on `127.0.0.1:8880`. At startup it loads the model and warms it up, so the first request is fast.
The very first run downloads the model, about 330 MB.

## API (OpenAI-compatible)

`POST /v1/audio/speech`

```json
{"model": "kokoro", "voice": "default", "input": "Hey, I'm here.", "response_format": "wav", "speed": 1, "stream": false}
```

- `response_format`: `wav` (the default and fastest, 24 kHz mono PCM16), `mp3` (encoded with ffmpeg), or `pcm` (raw s16le at 24 kHz).
- `stream: true`: sends a WAV header and then PCM chunks, one sentence at a time, using chunked transfer. Playback can start
  after the first sentence.
- The response headers include `X-Voice`, `X-Synth-Ms` and `X-Audio-Seconds`.
- `GET /health` returns `{ready, model, voice, ...}`. `GET /v1/audio/voices` lists the voices and aliases.

## Voices

- The default is **`af_heart`**. It's Kokoro's top-rated voice, warm, calm and conversational. You can override it with `VENT_TTS_VOICE`.
- `default`, `vent-calm`, `calm`, and any name the server doesn't recognise all map to the default voice.
- Any Kokoro voice id works, for example `af_bella`, `af_nicole`, `bf_emma`, `am_michael` or `bm_george`.
- The language comes from the first letter of the voice id.
- Hindi: `hf_alpha`, `hf_beta`, `hm_omega`, `hm_psi`. The aliases `hindi` and `hindi-male` also work.
- For Hinglish written in Latin script, `af_heart` sounds more natural. The Hindi voices read through Hindi espeak G2P.
- OpenAI names are aliased too: `alloy`, `nova`, `shimmer`, `echo`, `onyx`, `fable`.

## Latency (M4 Pro, warm, full HTTP round trip, WAV)

| Input | Voice | Time | Audio length |
|---|---|---|---|
| "Yeah… that sounds really frustrating. What happened after that?" | af_heart | **~148 ms** | 4.0 s |
| "Hmm." | af_heart | **~56 ms** | 1.3 s |
| "Acha, phir kya hua?" | af_heart | **~80 ms** | 2.0 s |
| "Acha, phir kya hua?" | hf_alpha / hm_omega | **~85 ms** | 2.3 s |
| Three sentences (7.2 s of audio) | af_heart | 240 ms in full; **114 ms to first audio** when streaming | 7.2 s |
| "Hmm." as mp3 | af_heart | ~126 ms | |

## Notes / caveats

- Requests are handled one at a time behind a lock, because MLX generation isn't thread-safe. Each request is
  quick, so this is fine for a single call.
- The first time a voice is used, its voice file has to load (up to about 2 s if it needs downloading). The default voice and `hf_alpha`
  are loaded during warmup.
- Voice cloning (Chatterbox and Chatterbox-Turbo through mlx-audio) was considered but not benchmarked. The weights were still downloading on a slow
  network when the time box ran out. It isn't wired up, and Kokoro stays the only engine.
