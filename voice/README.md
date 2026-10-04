# VENT local voice (TTS)

A local text-to-speech server for VENT. It uses **Kokoro-82M** (Apache-2.0, hexgrad) and runs on the Apple Silicon GPU through
**mlx-audio** (`mlx-community/Kokoro-82M-bf16`). Text goes through **misaki**, the same G2P Kokoro was trained with.
Homebrew `espeak-ng` covers words misaki doesn't know and Hindi.

It also has one **cloned voice, `owner`**: zero-shot voice cloning with **Chatterbox-Turbo** (Resemble AI, **MIT** licence),
running on MLX through mlx-audio (`mlx-community/chatterbox-turbo-8bit`, plus `mlx-community/S3TokenizerV2` for conditioning).
The voice is the product owner's own, used with his explicit permission. When the reference clip exists, this is the default voice.

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
The very first run downloads the models: about 330 MB for Kokoro, plus about 1.2 GB for Chatterbox-Turbo 8-bit and the S3 tokenizer
(the latter only when a reference clip exists). Startup takes about 10 s with the cloned voice.

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

- The default is **`owner`** (the cloned voice) when it's loaded. Otherwise it's **`af_heart`**, Kokoro's top-rated voice, which is warm, calm
  and conversational. Set `VENT_TTS_DEFAULT_VOICE` (e.g. `af_heart` or `owner`) to override this either way. The old `VENT_TTS_VOICE` also still works.
  If the override asks for `owner` but the clone isn't loaded, the server falls back to `af_heart`.
- `default`, `vent-calm`, `calm`, and any name the server doesn't recognise all map to the default voice.
- `GET /health` reports the clone's state under `clone` (`loaded`, `model`, `reference`, `error`).
- Any Kokoro voice id works, for example `af_bella`, `af_nicole`, `bf_emma`, `am_michael` or `bm_george`.
- The language comes from the first letter of the voice id.
- Hindi: `hf_alpha`, `hf_beta`, `hm_omega`, `hm_psi`. The aliases `hindi` and `hindi-male` also work.
- For Hinglish written in Latin script, `af_heart` sounds more natural. The Hindi voices read through Hindi espeak G2P.
- OpenAI names are aliased too: `alloy`, `nova`, `shimmer`, `echo`, `onyx`, `fable`.

## Cloned voice (`owner`)

- **Reference clip.** At startup the server uses the first of these files that exists: `voice/voices/owner-script.wav` (a scripted recording),
  then `voice/voices/owner.wav` (a cleaned 16 s clip). Use a clip longer than 5 s; only the first 10 to 15 s are used. The speaker
  conditioning (voice embedding and prompt tokens) is computed **once** at startup and cached. To pick up a new clip, restart the server.
  `voice/voices/` is gitignored, so never commit the audio.
- **No reference?** Then the clone isn't loaded, `owner` maps to the default voice, and Kokoro works exactly as before. A load failure
  is logged and is also non-fatal.
- **Settings.** `VENT_TTS_CLONE_MODEL` defaults to `mlx-community/chatterbox-turbo-8bit`. `mlx-community/chatterbox-turbo-fp16` is
  about 30% slower and sounds no different. `VENT_TTS_CLONE_TEMPERATURE` defaults to `0.5`, which is lower than the model's 0.8. That cuts down
  "babble" on very short inputs.
- **Short-line guard.** Speech tokens are capped by text length. If the output is implausibly long for the text, the line is regenerated once
  and the shorter take is kept.
- **Streaming.** `stream: true` works the same as with Kokoro: one sentence at a time, so the first sentence plays after about 0.5 s.
- Caveats:
  - `speed` is ignored. Chatterbox-Turbo has no speed control.
  - The model is English-only. Hinglish in Latin script comes out understandable but accented, roughly "आरे, फिरी क्या हो?" for "Arre, phir kya hua?".
  - Output is sampled, so every take is slightly different.
  - One-word interjections ("Hmm.") still sometimes come out as a mumble.
  - Unlike Resemble's PyTorch package, the MLX port doesn't add Resemble's Perth watermark.
- Memory: about 1.5 GB of extra unified memory.

### Clone latency (M4 Pro, warm, full HTTP round trip, WAV, Chatterbox-Turbo 8-bit)

| Input | Time (median) | Audio length | RTF |
|---|---|---|---|
| "Wait, he blamed you? For the release delay?" | **~590 ms** | 2.5 s | 0.23 |
| "Hmm, then what?" | **~440 ms** | 1.9 s | 0.24 |
| "Arre, phir kya hua?" | **~500 ms** | 2.6 s | 0.19 |
| "Hey, what's up?" | ~400 ms | 1.5 to 1.8 s | 0.22 |
| Four sentences (about 7 s of audio), `stream: true` | **~500 ms to first audio**, 1.7 s in total | 7.0 s | |

With fp16 the same lines took about 785, 545 and 690 ms. A Kokoro voice takes about 115 ms for the 8-word line.

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
- Both engines share the one generation lock, so a long cloned line will delay a Kokoro request that comes in at the same time.
