# VENT local voice (TTS)

A local text-to-speech server for VENT. It uses **Kokoro-82M** (Apache-2.0, hexgrad) and runs on the Apple Silicon GPU through
**mlx-audio** (`mlx-community/Kokoro-82M-bf16`). Text goes through **misaki**, the same G2P Kokoro was trained with.
Homebrew `espeak-ng` covers words misaki doesn't know and Hindi.

It can also speak in **your own voice, `owner`**: zero-shot voice cloning with **Chatterbox-Turbo** (Resemble AI, **MIT** licence),
running on MLX through mlx-audio (`mlx-community/chatterbox-turbo-8bit`, plus `mlx-community/S3TokenizerV2` for conditioning).
Record a reference with `pnpm voice:record`. `start.sh` then enables the clone automatically (`VENT_TTS_CLONE=1`) and makes it the default
voice. With no recording, VENT uses Kokoro. Set `VENT_TTS_CLONE=0` to keep Kokoro even when a recording exists.

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
The very first run downloads about 330 MB for Kokoro. The first run after you record a voice also downloads about 1.2 GB for Chatterbox-Turbo 8-bit and the S3 tokenizer.
Warmup takes about 3.5 s by default, or about 6 s (10 s or more in total) with the clone.

## API (OpenAI-compatible)

`POST /v1/audio/speech`

```json
{"model": "kokoro", "voice": "default", "input": "Hey, I'm here.", "response_format": "wav", "speed": 1, "stream": false, "style": "calm"}
```

- `style` (optional): `calm` (the default), `fired`, `breathless` or `bright`. Anything else, or leaving it out, means `calm`, which is
  exactly the old behaviour. Works for every voice, with or without `stream`. See [Styles](#styles-call-modes).
- `response_format`: `wav` (the default and fastest, 24 kHz mono PCM16), `mp3` (encoded with ffmpeg), or `pcm` (raw s16le at 24 kHz).
- `stream: true`: sends a WAV header and then PCM chunks, one sentence at a time, using chunked transfer. Playback can start
  after the first sentence.
- The response headers include `X-Voice`, `X-Style`, `X-Synth-Ms` and `X-Audio-Seconds` (streaming responses only have `X-Voice` and `X-Style`).
- `GET /health` returns `{ready, model, voice, styles, ...}`. `GET /v1/audio/voices` lists the voices and aliases.

## Voices

- The default is **`af_heart`**, Kokoro's top-rated voice: warm, calm and conversational. Set `VENT_TTS_DEFAULT_VOICE` to override it.
  The old `VENT_TTS_VOICE` also still works. Setting it to `owner` only takes effect together with `VENT_TTS_CLONE=1`.
- `owner` only works when the clone is enabled. Otherwise it falls back to `af_heart`.
- `default`, `vent-calm`, `calm`, and any name the server doesn't recognise all map to the default voice.
- `GET /health` reports the clone's state under `clone` (`enabled`, `loaded`, `model`, `reference`, `error`).
- Any Kokoro voice id works, for example `af_bella`, `af_nicole`, `bf_emma`, `am_michael` or `bm_george`.
- The language comes from the first letter of the voice id.
- Hindi: `hf_alpha`, `hf_beta`, `hm_omega`, `hm_psi`. The aliases `hindi` and `hindi-male` also work.
- For Hinglish written in Latin script, `af_heart` sounds more natural. The Hindi voices read through Hindi espeak G2P.
- OpenAI names are aliased too: `alloy`, `nova`, `shimmer`, `echo`, `onyx`, `fable`.

## Your cloned voice (`owner`)

- **Reference clip.** At startup the server uses the first of these files that exists: `voice/voices/owner-script.wav` (a scripted recording),
  then `voice/voices/owner.wav` (a cleaned 16 s clip). Use a clip longer than 5 s; only the first 10 to 15 s are used. The speaker
  conditioning (voice embedding and prompt tokens) is computed **once** at startup and cached. To pick up a new clip, restart the server.
  `voice/voices/` is gitignored, so the audio is never committed. `pnpm voice:record` writes `owner-script.wav` and restarts the server.
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

## Styles (call modes)

Each VENT call mode gets its own delivery. The code is in `voice/styles.py`, and `server.py` calls it from `synth()`.

| `style` | App mode | How it should sound |
|---|---|---|
| `calm` | Breathe | Unchanged. This is the pre-style output, bit for bit. |
| `fired` | Punch / devil | Racing, clipped and pushed, like a friend who's furious on your behalf. |
| `breathless` | Sweat | Out of breath mid-workout: short phrases with audible breaths between them. |
| `bright` | Journal | A bit enthusiastic, curious about you. Warmer and livelier than calm, but not frantic. |

Since the clone was switched off, the styles have been re-tuned on **af_heart** (the default). Where Kokoro and the clone differ, both settings are listed below.

**What the model can do (checked first).** mlx-audio's `ChatterboxTurboTTS.generate()` accepts `exaggeration` and `cfg_weight`, but
Turbo ignores both and logs a warning. It has no speed control either. The tokenizer does have paralinguistic tags (`[angry]`, `[gasp]`,
`[sigh]`, `[laugh]`, `[whispering]` …). Whisper confirmed the tags aren't read out as words. With this 8-bit model and this reference clip, though,
`[gasp]` and `[sigh]` mostly come out as **near-silent pauses** (gap RMS 0.001–0.004). They also add 0.4–0.8 s of tokens (about 100–250 ms of generation).
`[angry]` and `!` made no measurable difference to pitch, rate or brightness over several takes. Raising temperature to 0.8 added
mispronunciations ("keep blowing"). So the clone is left on its usual settings, and the styles come from text nudges plus DSP. Kokoro has a
native `speed`, which is used instead of time-stretching.

**`fired`**
- Kokoro: `speed` × 1.13 (native).
- Chatterbox: pauses longer than 110 ms are cut to about 45% of their length (at least 70 ms), so the delivery is clipped. Then a pitch-up of about +0.7 semitone
  (resample by 24/25) and a **WSOLA** time-stretch bring the total tempo to about 1.14×. The pitch doesn't chipmunk: WSOLA keeps the pitch, and only the 0.7 st comes from the resample.
- Both engines: the same pause trimming. Kokoro also gets the +0.7 st, with its tempo kept. Then a 110 Hz high-pass, 3:1 compression above −26 dB, tanh saturation,
  and loudness about +2 dB over calm. Peaks stay under 0.92.
- The EQ differs by engine. The clone gets a presence peak of +4.5 dB at 3 kHz plus +1.5 dB at 5.2 kHz, with drive 1.6. Kokoro is already bright (spectral centroid
  about 4 kHz against about 1.3 kHz for the clone), so it gets only +2.5 dB at 3 kHz, a 9 kHz low-pass and drive 1.3. That keeps it from turning harsh or sibilant.
- Measured on af_heart: 3.36 words/s against 2.99 for calm, 3.5 s of audio against 3.9 s, and RMS 0.062 against 0.047. Energy above 8 kHz falls from 3.4% to 1.8% (less hiss).

**`breathless`**
- Text: inside long runs without punctuation (more than 5 words), a comma goes before clause words ("and", "because", "when", …) but never after
  articles, auxiliaries or pronouns. That gives the speaker somewhere to breathe, e.g. "So you went to the meeting, and he just yelled at you in front of everyone, because of the release?"
- Kokoro: `speed` × 1.05, and **one Kokoro call per phrase** (about 50 ms each), joined with real gaps of 0.14 s after a comma and 0.28 s after a sentence. Kokoro barely
  pauses at commas otherwise. Chatterbox: a single call (per-phrase calls would multiply its fixed cost), then a WSOLA stretch to 1.05×.
- DSP (both engines): every internal pause of 90 ms or more (shorter gaps are plosive closures and are left alone) becomes a synthesised breath. A short pause gets a quick catch-breath inhale
  (0.17–0.23 s). A longer one (0.22 s or more, i.e. a sentence break) gets an exhale and then a deeper inhale. Each line also starts with an inhale and ends with a trailing "hhh" exhale.
  Breaths are pink noise through breathy 'h' formant bands. Inhales are brighter, with a rising envelope that cuts off when the speech starts. Exhales are darker,
  with a quick onset and a long tail. Both have a little 9–13 Hz flutter.
- Kokoro gets a **subtler** setting, because its clean, bright timbre makes noise stand out:
  - breaths are about 14 dB below the speech (the clone's are about 11 dB below) and 20% shorter;
  - the hiss band above 2.8 kHz in the inhale drops to 0.25× (0.55× on the clone);
  - a sentence break gets just an inhale, with no exhale before it;
  - the aspiration noise is 0.04× (0.1× on the clone).
  On the sample line af_heart breathless runs 4.7 s against 3.9 s calm.
- Both engines also get a slight breathy voice (aspiration noise in the 1.8–6.5 kHz band that follows the speech envelope) and a 3.6–4.6 Hz amplitude
  tremor of ±8% for effort.
- Breaths are seeded from the text, so the same line always gets the same breaths. Calm and fired are deterministic apart from the
  clone's own sampling.

**`bright`**
- Kokoro: `speed` × 1.07 (native). Clone: a WSOLA stretch to 1.07×.
- Pitch lift of +0.40 semitone (resample 43/44, with the extra tempo compensated by WSOLA).
- Gentle, wide EQ: a 80 Hz high-pass, +1.5 dB of warmth at 220 Hz, +2 dB of presence at 2.8 kHz and +1.5 dB of air at 6 kHz.
- Livelier dynamics: a mild *upward* expansion of the level contour (gain ∝ (envelope/median)^0.2, clamped to ±3 dB), so stressed syllables pop a little.
  This is the opposite of fired's compression. Loudness is about +1 dB over calm.
- No pause trimming and no saturation, so it stays natural. Measured on af_heart: 3.50 words/s against 3.33 for calm on "Hey! How was today? Tell me everything.",
  and pitch 202 Hz against 195 Hz on the sample line.

**Streaming.** The style is applied per sentence, so with `breathless` each streamed sentence starts with an inhale and ends with an exhale.

**Samples** (gitignored, all **af_heart**): `voice/voices/style-calm.wav`, `style-fired.wav` and `style-breathless.wav` say
"Wait, he said that to you? Seriously? Okay, keep going." `style-bright.wav` says "Hey! How was today? Tell me everything."
Whisper large-v3-turbo (MLX) got every word right in all four, plus bright on the "Wait…" line and calm on the "Hey!…" line. It only missed punctuation;
breathless came back as "Wait, he said that to you. Seriously. Okay, keep going." No clipped samples. Peaks are 0.37–0.61.
(The earlier clone versions of these samples were overwritten.)

### Style latency (M4 Pro, warm, full HTTP round trip, WAV)

af_heart (default), "Wait, he blamed you? For the release delay?" (8 words), median of 7:

| no style | calm | fired | breathless | bright |
|---|---|---|---|---|
| 115 ms (3.0 s audio) | 114 ms (3.0 s) | 117 ms (2.7 s) | 204 ms (3.1 s, per-phrase calls) | 117 ms (2.9 s) |

Streaming two sentences on af_heart: first audio after about 80 ms (calm, fired, bright) or 134 ms (breathless). DSP costs about 10–25 ms per sentence.

The clone (`VENT_TTS_CLONE=1`), measured before bright existed, median of 5: 578 ms for calm, 615 ms for fired and 617 ms for breathless on the 8-word line.
First streamed audio came after about 480–530 ms. Expect bright to come in at about calm + 30 ms.

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
- `bright`/`fired` on the clone haven't been listened to or re-checked since the switch to af_heart. Their clone settings are the ones described above.
- Styles are DSP, not a different recording. `fired` is a faster, brighter, compressed take of the same voice: it doesn't
  add anger the model didn't produce. `breathless` breaths are synthetic noise, so they're plausible but not the owner's real breathing. If they sound
  too loud or too hissy, change `br = (0.28 if clone else 0.20) * ref` in `styles._breathless`.
- `[gasp]`/`[sigh]` tags from upstream text pass straight through to the clone (Kokoro would read them out). They're tokenized and not spoken, but they add pauses (and latency).
- Both engines share the one generation lock, so a long cloned line will delay a Kokoro request that comes in at the same time.
