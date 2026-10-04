"""VENT local TTS server: Kokoro-82M on Apple Silicon via mlx-audio,
plus an optional zero-shot cloned voice ("owner") via Chatterbox-Turbo (mlx-audio).

OpenAI-compatible:  POST /v1/audio/speech  {model, voice, input, response_format, speed, stream?}
Health:             GET  /health
"""

from __future__ import annotations

import io
import os
import re
import shutil
import struct
import subprocess
import threading
import time
from pathlib import Path

os.environ.setdefault("TQDM_DISABLE", "1")  # Chatterbox prints per-request progress bars otherwise
# espeak-ng (Homebrew) is used by misaki for out-of-vocabulary words and Hindi.
_BREW_ESPEAK = "/opt/homebrew/opt/espeak-ng"
if os.path.isdir(_BREW_ESPEAK):
    os.environ.setdefault("PHONEMIZER_ESPEAK_LIBRARY", f"{_BREW_ESPEAK}/lib/libespeak-ng.dylib")
    os.environ.setdefault("ESPEAK_DATA_PATH", f"{_BREW_ESPEAK}/share/espeak-ng-data")

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import BaseModel

MODEL_REPO = os.environ.get("VENT_TTS_MODEL", "mlx-community/Kokoro-82M-bf16")
KOKORO_DEFAULT = "af_heart"
SAMPLE_RATE = 24000

# Cloned voice: Chatterbox-Turbo (MIT) zero-shot, conditioned once at startup on a reference clip.
CLONE_VOICE = "owner"
# 8-bit: ~30% faster than fp16 on an M4 Pro (580 vs 800 ms for an 8-word line), no audible/ASR difference.
CLONE_MODEL_REPO = os.environ.get("VENT_TTS_CLONE_MODEL", "mlx-community/chatterbox-turbo-8bit")
# 0.5 instead of the model's 0.8: fewer babble/hallucination tails on very short inputs ("Hmm.").
CLONE_TEMPERATURE = float(os.environ.get("VENT_TTS_CLONE_TEMPERATURE", "0.5"))
VOICES_DIR = Path(__file__).resolve().parent / "voices"
# First existing file wins: the scripted recording beats the cleaned call clip.
CLONE_REFS = [VOICES_DIR / "owner-script.wav", VOICES_DIR / "owner.wav"]
# "default"/"vent-calm" -> owner when the clone is loaded (it met the <=1.3 s warm target for an
# ~8-word line on an M4 Pro), else af_heart. VENT_TTS_DEFAULT_VOICE (or legacy VENT_TTS_VOICE) overrides.
DEFAULT_VOICE_ENV = os.environ.get("VENT_TTS_DEFAULT_VOICE") or os.environ.get("VENT_TTS_VOICE")
DEFAULT_VOICE = KOKORO_DEFAULT  # resolved at startup

KOKORO_VOICES = {
    "af_alloy", "af_aoede", "af_bella", "af_heart", "af_jessica", "af_kore", "af_nicole",
    "af_nova", "af_river", "af_sarah", "af_sky", "am_adam", "am_echo", "am_eric", "am_fenrir",
    "am_liam", "am_michael", "am_onyx", "am_puck", "am_santa", "bf_alice", "bf_emma",
    "bf_isabella", "bf_lily", "bm_daniel", "bm_fable", "bm_george", "bm_lewis", "ef_dora",
    "em_alex", "em_santa", "ff_siwis", "hf_alpha", "hf_beta", "hm_omega", "hm_psi", "if_sara",
    "im_nicola", "jf_alpha", "jf_gongitsune", "jf_nezumi", "jf_tebukuro", "jm_kumo", "pf_dora",
    "pm_alex", "pm_santa", "zf_xiaobei", "zf_xiaoni", "zf_xiaoxiao", "zf_xiaoyi", "zm_yunjian",
    "zm_yunxi", "zm_yunxia", "zm_yunyang",
}
# Friendly aliases (OpenAI voice names + app names) -> Kokoro voices.
ALIASES = {
    "default": KOKORO_DEFAULT, "vent-calm": KOKORO_DEFAULT, "calm": KOKORO_DEFAULT,
    "alloy": "af_heart", "nova": "af_nova", "shimmer": "af_bella", "echo": "am_echo",
    "onyx": "am_onyx", "fable": "bm_fable", "male": "am_michael", "female": "af_heart",
    "hindi": "hf_alpha", "hindi-male": "hm_omega",
}

app = FastAPI(title="VENT TTS (Kokoro-82M / MLX)")
_model = None
_clone = None  # Chatterbox-Turbo model with cached speaker conditionals, or None
_clone_ref: str | None = None
_clone_error: str | None = None
_lock = threading.Lock()  # MLX generation is not thread-safe; serialize.
_ready = False
_warm_ms: float | None = None


def resolve_voice(name: str | None) -> str:
    n = (name or "").strip().lower()
    if n in KOKORO_VOICES:
        return n
    if n == CLONE_VOICE:
        return CLONE_VOICE if _clone is not None else DEFAULT_VOICE
    return ALIASES.get(n, DEFAULT_VOICE)


def _clone_once(text: str) -> np.ndarray:
    # Cap speech tokens (25/s) by text length so a short line can't ramble on.
    max_tokens = min(800, 40 + 4 * len(text))
    with _lock:
        parts = [np.asarray(r.audio, dtype=np.float32).reshape(-1)
                 for r in _clone.generate(text=text, temperature=CLONE_TEMPERATURE, max_tokens=max_tokens)]
    return np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32)


def synth_clone(text: str) -> np.ndarray:
    # Chatterbox-Turbo has no speed control; `speed` is ignored for the cloned voice.
    # It's sampled, so short inputs occasionally hallucinate extra words: if the audio is far
    # longer than the text could plausibly take, regenerate once and keep the shorter take.
    a = _clone_once(text)
    limit_s = 1.2 + 0.15 * len(text)
    if len(a) / SAMPLE_RATE > limit_s:
        b = _clone_once(text)
        a = b if len(b) < len(a) else a
    return a


def synth(text: str, voice: str, speed: float) -> np.ndarray:
    if voice == CLONE_VOICE:
        return synth_clone(text)
    lang = voice[0]  # Kokoro convention: first letter of voice is the language code
    with _lock:
        parts = [np.asarray(r.audio, dtype=np.float32).reshape(-1)
                 for r in _model.generate(text=text, voice=voice, speed=speed, lang_code=lang)]
    if not parts:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(parts)


def to_pcm16(a: np.ndarray) -> bytes:
    return (np.clip(a, -1.0, 1.0) * 32767).astype("<i2").tobytes()


def wav_bytes(a: np.ndarray) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, a, SAMPLE_RATE, format="WAV", subtype="PCM_16")
    return buf.getvalue()


def streaming_wav_header() -> bytes:
    # Unknown-length WAV header (sizes set to max); browsers/ffmpeg accept this.
    data_size = 0xFFFFFFFF - 36
    return (b"RIFF" + struct.pack("<I", 0xFFFFFFFF) + b"WAVEfmt "
            + struct.pack("<IHHIIHH", 16, 1, 1, SAMPLE_RATE, SAMPLE_RATE * 2, 2, 16)
            + b"data" + struct.pack("<I", data_size))


def mp3_bytes(a: np.ndarray) -> bytes:
    if not shutil.which("ffmpeg"):
        raise HTTPException(500, "ffmpeg not found for mp3 encoding")
    p = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-f", "s16le", "-ar", str(SAMPLE_RATE), "-ac", "1",
         "-i", "pipe:0", "-codec:a", "libmp3lame", "-b:a", "96k", "-f", "mp3", "pipe:1"],
        input=to_pcm16(a), capture_output=True, check=True)
    return p.stdout


_SENT_RE = re.compile(r"(?<=[.!?…])\s+|\n+")


def split_sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENT_RE.split(text) if s and s.strip()]


class SpeechRequest(BaseModel):
    model: str | None = "kokoro"
    input: str
    voice: str | None = "default"
    response_format: str | None = "wav"
    speed: float | None = 1.0
    stream: bool | None = False


def _load_clone(load_model) -> None:
    """Load Chatterbox-Turbo and cache speaker conditioning, only if a reference clip exists."""
    global _clone, _clone_ref, _clone_error
    ref = next((p for p in CLONE_REFS if p.is_file()), None)
    if ref is None:
        _clone_error = "no reference clip in voice/voices/"
        print(f"[vent-tts] clone voice '{CLONE_VOICE}' disabled: {_clone_error}", flush=True)
        return
    try:
        t = time.perf_counter()
        m = load_model(CLONE_MODEL_REPO)
        m.prepare_conditionals(str(ref))  # speaker embedding + prompt tokens, computed once
        _clone, _clone_ref = m, ref.name
        synth_clone("Hey, I'm here.")
        synth_clone("Hmm, then what?")
        print(f"[vent-tts] clone voice '{CLONE_VOICE}' ready from {ref.name} "
              f"({CLONE_MODEL_REPO}, {(time.perf_counter() - t) * 1000:.0f}ms)", flush=True)
    except Exception as e:  # noqa: BLE001 - server must keep working without the clone
        _clone, _clone_error = None, f"{type(e).__name__}: {e}"
        print(f"[vent-tts] clone voice '{CLONE_VOICE}' failed to load (non-fatal): {_clone_error}", flush=True)


def _resolve_default() -> str:
    want = (DEFAULT_VOICE_ENV or (CLONE_VOICE if _clone is not None else KOKORO_DEFAULT)).strip().lower()
    if want == CLONE_VOICE and _clone is None:
        print(f"[vent-tts] default voice '{want}' unavailable; using {KOKORO_DEFAULT}", flush=True)
        return KOKORO_DEFAULT
    if want != CLONE_VOICE and want not in KOKORO_VOICES:
        want = ALIASES.get(want, KOKORO_DEFAULT)
    return want


@app.on_event("startup")
def _startup() -> None:
    global _model, _ready, _warm_ms, DEFAULT_VOICE
    from mlx_audio.tts.utils import load_model

    _model = load_model(MODEL_REPO)
    t = time.perf_counter()
    synth("Hey, I'm here. Take your time.", KOKORO_DEFAULT, 1.0)
    synth("Hmm.", KOKORO_DEFAULT, 1.0)
    try:
        synth("Acha.", "hf_alpha", 1.0)  # warm Hindi G2P pipeline too
    except Exception as e:  # noqa: BLE001
        print(f"[vent-tts] Hindi warmup failed (non-fatal): {e}")
    _load_clone(load_model)
    DEFAULT_VOICE = _resolve_default()
    for k in ("default", "vent-calm", "calm"):
        ALIASES[k] = DEFAULT_VOICE
    _warm_ms = (time.perf_counter() - t) * 1000
    _ready = True
    print(f"[vent-tts] ready: {MODEL_REPO} voice={DEFAULT_VOICE} warmup={_warm_ms:.0f}ms", flush=True)


@app.get("/health")
def health():
    return {"ready": _ready, "model": MODEL_REPO, "engine": "kokoro-82m (mlx-audio)",
            "voice": DEFAULT_VOICE, "sample_rate": SAMPLE_RATE, "warmup_ms": _warm_ms,
            "clone": {"voice": CLONE_VOICE, "loaded": _clone is not None, "model": CLONE_MODEL_REPO,
                      "reference": _clone_ref, "error": _clone_error}}


@app.get("/v1/audio/voices")
def voices():
    cloned = [CLONE_VOICE] if _clone is not None else []
    return {"default": DEFAULT_VOICE, "voices": cloned + sorted(KOKORO_VOICES), "aliases": ALIASES}


@app.post("/v1/audio/speech")
def speech(req: SpeechRequest):
    if not _ready:
        raise HTTPException(503, "model warming up")
    text = (req.input or "").strip()
    if not text:
        raise HTTPException(400, "input is empty")
    voice = resolve_voice(req.voice)
    speed = float(req.speed or 1.0)
    speed = min(max(speed, 0.5), 2.0)
    fmt = (req.response_format or "wav").lower()

    if req.stream:
        if fmt not in ("wav", "pcm"):
            raise HTTPException(400, "streaming supports response_format wav or pcm")

        def gen():
            if fmt == "wav":
                yield streaming_wav_header()
            for sent in split_sentences(text):
                yield to_pcm16(synth(sent, voice, speed))

        media = "audio/wav" if fmt == "wav" else "audio/L16;rate=24000;channels=1"
        return StreamingResponse(gen(), media_type=media, headers={"X-Voice": voice})

    t = time.perf_counter()
    audio = synth(text, voice, speed)
    synth_ms = (time.perf_counter() - t) * 1000
    headers = {"X-Voice": voice, "X-Synth-Ms": f"{synth_ms:.0f}",
               "X-Audio-Seconds": f"{len(audio) / SAMPLE_RATE:.2f}"}
    if fmt == "mp3":
        return Response(mp3_bytes(audio), media_type="audio/mpeg", headers=headers)
    if fmt == "pcm":
        return Response(to_pcm16(audio), media_type="audio/L16;rate=24000;channels=1", headers=headers)
    return Response(wav_bytes(audio), media_type="audio/wav", headers=headers)


@app.exception_handler(Exception)
async def _err(_, exc: Exception):
    return JSONResponse({"error": str(exc)}, status_code=500)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=os.environ.get("VENT_TTS_HOST", "127.0.0.1"),
                port=int(os.environ.get("VENT_TTS_PORT", "8880")), log_level="info")
