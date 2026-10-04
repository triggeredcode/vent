"""Delivery styles for VENT's three call modes, applied on top of either engine.

  calm        Breathe mode. Untouched: exactly the pre-style behaviour.
  fired       Punch / devil mode. Racing, clipped, pushed: a friend who's furious on your behalf.
  breathless  Sweat mode. Out of breath mid-workout: short phrases with audible breaths between them.

Each style has two halves:
  * text / model side (`prepare_text`, `kokoro_speed`): cheap nudges given to the TTS model itself.
  * DSP (`apply`): numpy/scipy post-processing on the 24 kHz float32 output. This is pure CPU work, a few
    tens of milliseconds per sentence, and is deterministic (fixed seeds) so a line always sounds the same.

The DSP is deliberately conservative: nothing here rewrites the spectrum of the words themselves enough to hurt
intelligibility (checked with Whisper large-v3-turbo; see README).
"""

from __future__ import annotations

import re
import zlib

import numpy as np
from scipy.signal import butter, lfilter, resample_poly, sosfilt

SR = 24000
STYLES = ("calm", "fired", "breathless")


def normalize_style(style: str | None) -> str:
    s = (style or "").strip().lower()
    return s if s in STYLES else "calm"


# --------------------------------------------------------------------------------------------- text side
# A breathless speaker grabs air before these words (conjunctions, prepositions, clause starters)...
_BREAK_BEFORE = {
    "and", "but", "so", "because", "cause", "when", "while", "after", "before", "then", "since",
    "until", "which", "who", "where", "or", "if", "for",
}
# ...and never right after these (articles, auxiliaries, pronouns...).
_NO_BREAK_AFTER = {
    "a", "an", "the", "to", "of", "in", "on", "at", "for", "with", "my", "your", "his", "her", "our",
    "their", "its", "and", "or", "but", "so", "is", "was", "are", "were", "be", "been", "has", "have",
    "had", "will", "would", "could", "should", "can", "do", "did", "does", "i", "you", "he", "she", "we",
    "they", "it", "that", "this", "just", "really", "very", "not", "don't", "can't", "i'm", "it's",
    "what", "how", "if", "as", "by", "from", "about", "like", "much", "more", "some", "too",
}
_PUNCT_END = re.compile(r"[,.!?;:\u2026-]$")


def _chop_run(words: list[str]) -> list[str]:
    """Add commas inside long unpunctuated runs (>5 words) so a breathless speaker gets somewhere to breathe."""
    out = list(words)
    i, n = 0, len(words)
    while i < n:
        j = i
        while j < n and not _PUNCT_END.search(words[j]):
            j += 1
        run_end = min(j, n - 1)  # inclusive index of the run's last word
        if run_end - i + 1 > 5:
            last = i - 1
            for b in range(i + 2, run_end - 1):  # break goes after words[b]; keep >=2 words each side
                if b - last < 3:
                    continue
                nxt = words[b + 1].lower().strip("'\"")
                cur = words[b].lower().strip("'\"")
                if nxt in _BREAK_BEFORE and cur not in _NO_BREAK_AFTER:
                    out[b] = out[b] + ","
                    last = b
        i = j + 1
    return out


def prepare_text(text: str, style: str, clone: bool) -> str:
    """Model-side text nudges. calm returns the text unchanged."""
    if style == "breathless":
        words = text.split()
        if len(words) > 5:
            text = " ".join(_chop_run(words))
    return text


def kokoro_speed(speed: float, style: str) -> float:
    """Kokoro has a native speed control; use it instead of time-stretching (better quality, zero cost)."""
    mult = {"calm": 1.0, "fired": 1.13, "breathless": 1.05}[style]
    return min(max(speed * mult, 0.5), 2.0)


# ------------------------------------------------------------------------------------------- DSP helpers
def _seed(a: np.ndarray, salt: str) -> np.random.Generator:
    return np.random.default_rng(zlib.crc32(salt.encode()) ^ (len(a) & 0xFFFFFFFF))


def wsola(x: np.ndarray, rate: float, frame_ms: float = 30.0, tol_ms: float = 8.0) -> np.ndarray:
    """Time-stretch by `rate` (>1 = faster) without changing pitch: WSOLA (waveform-similarity overlap-add)."""
    if abs(rate - 1.0) < 1e-3 or len(x) < 4 * SR // 100:
        return x
    n = int(SR * frame_ms / 1000) // 2 * 2
    hs = n // 2
    ha = hs * rate
    tol = int(SR * tol_ms / 1000)
    win = np.hanning(n).astype(np.float32)
    xp = np.concatenate([np.zeros(tol, np.float32), x.astype(np.float32), np.zeros(n + tol, np.float32)])
    frames = int((len(x) - n) / ha) + 1
    out = np.zeros(frames * hs + n, np.float32)
    norm = np.zeros_like(out)
    prev = tol  # position (in xp) of the previously copied frame
    for k in range(max(frames, 1)):
        nominal = int(round(k * ha)) + tol
        if k == 0:
            pos = nominal
        else:
            target = xp[prev + hs: prev + hs + n]  # natural continuation of the previous frame
            lo, hi = nominal - tol, nominal + tol
            seg = xp[lo: hi + n]
            if len(seg) < n or len(target) < n:
                pos = nominal
            else:
                c = np.correlate(seg, target, mode="valid")
                pos = lo + int(np.argmax(c))
        out[k * hs: k * hs + n] += xp[pos: pos + n] * win
        norm[k * hs: k * hs + n] += win
        prev = pos
    norm[norm < 1e-3] = 1.0
    y = out / norm
    return y[: int(len(x) / rate)]


def _peaking(x: np.ndarray, f0: float, gain_db: float, q: float) -> np.ndarray:
    """RBJ peaking EQ biquad."""
    a_ = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / SR
    alpha = np.sin(w0) / (2 * q)
    b = np.array([1 + alpha * a_, -2 * np.cos(w0), 1 - alpha * a_])
    a = np.array([1 + alpha / a_, -2 * np.cos(w0), 1 - alpha / a_])
    return lfilter(b / a[0], a / a[0], x).astype(np.float32)


def _envelope(x: np.ndarray, ms: float = 10.0) -> np.ndarray:
    """Per-sample RMS envelope (block RMS, linearly interpolated)."""
    hop = max(1, int(SR * ms / 1000))
    nb = max(1, len(x) // hop)
    blocks = x[: nb * hop].reshape(nb, hop)
    rms = np.sqrt(np.mean(blocks ** 2, axis=1) + 1e-12)
    return np.interp(np.arange(len(x)), np.arange(nb) * hop + hop / 2, rms).astype(np.float32)


def _compress(x: np.ndarray, thresh_db: float = -24.0, ratio: float = 3.0, makeup_db: float = 0.0) -> np.ndarray:
    env = _envelope(x, 8.0)
    lvl = 20 * np.log10(env + 1e-9)
    over = np.maximum(lvl - thresh_db, 0.0)
    gain_db = -over * (1 - 1 / ratio) + makeup_db
    # smooth the gain (fast attack / slower release feel) with a short moving average
    k = int(SR * 0.012)
    gain_db = np.convolve(gain_db, np.ones(k) / k, mode="same")
    return (x * 10 ** (gain_db / 20)).astype(np.float32)


def _saturate(x: np.ndarray, drive: float) -> np.ndarray:
    peak = float(np.max(np.abs(x))) or 1.0
    y = np.tanh(drive * x / peak) / np.tanh(drive)
    return (y * peak).astype(np.float32)


def _active_rms(x: np.ndarray) -> float:
    env = _envelope(x, 20.0)
    m = env > 0.1 * (env.max() + 1e-9)
    return float(np.sqrt(np.mean(x[m] ** 2))) if m.any() else float(np.sqrt(np.mean(x ** 2) + 1e-12))


def _finish(y: np.ndarray, ref_rms: float, gain: float = 1.0, ceiling: float = 0.92) -> np.ndarray:
    """Match loudness to the input's active RMS (x gain), then keep peaks under the ceiling."""
    r = _active_rms(y)
    if r > 0:
        y = y * (ref_rms * gain / r)
    pk = float(np.max(np.abs(y))) if len(y) else 0.0
    if pk > ceiling:
        y = y * (ceiling / pk)
    return y.astype(np.float32)


def _silences(x: np.ndarray, min_ms: float, db_below: float = 32.0) -> list[tuple[int, int]]:
    """Internal silent runs (start, end) in samples; leading/trailing silence excluded."""
    hop = int(SR * 0.01)
    env = _envelope(x, 10.0)[::hop]
    if not len(env):
        return []
    thr = env.max() * 10 ** (-db_below / 20)
    quiet = env < thr
    runs, i = [], 0
    voiced = np.flatnonzero(~quiet)
    if not len(voiced):
        return []
    first, last = voiced[0], voiced[-1]
    i = first
    while i <= last:
        if quiet[i]:
            j = i
            while j <= last and quiet[j]:
                j += 1
            if (j - i) * 10 >= min_ms:
                runs.append((i * hop, j * hop))
            i = j
        else:
            i += 1
    return runs


def _trim_edges(x: np.ndarray, keep_ms: float = 40.0) -> np.ndarray:
    hop = int(SR * 0.01)
    env = _envelope(x, 10.0)[::hop]
    if not len(env):
        return x
    voiced = np.flatnonzero(env > env.max() * 10 ** (-40 / 20))
    if not len(voiced):
        return x
    k = int(SR * keep_ms / 1000)
    return x[max(0, voiced[0] * hop - k): min(len(x), (voiced[-1] + 1) * hop + k)]


# ------------------------------------------------------------------------------------------------- fired
def _fired(x: np.ndarray, tempo: float) -> np.ndarray:
    ref = _active_rms(x)
    # 1. Clipped: shorten internal pauses (>110 ms -> ~60-45% of their length, min 70 ms).
    parts, prev = [], 0
    for s, e in _silences(x, 110):
        keep = max(int(SR * 0.07), int((e - s) * 0.45))
        mid = s + (e - s) // 2
        parts.append(x[prev: mid - keep // 2])
        prev = mid + (keep - keep // 2)
    parts.append(x[prev:])
    x = np.concatenate(parts) if parts else x
    # 2. Racing: slight pitch-up (~0.7 semitone, adds tension) + tempo-up without chipmunking.
    #    Resample (raises pitch AND tempo by p), then WSOLA the remaining tempo.
    p_up, p_down = 25, 24  # pitch ratio 1.0417 = +0.71 semitone
    y = resample_poly(x, p_down, p_up).astype(np.float32)
    y = wsola(y, tempo / (p_up / p_down))
    # 3. Urgency: tighten lows, push presence (2-4 kHz), a little edge at 5 kHz.
    y = sosfilt(butter(2, 110, "highpass", fs=SR, output="sos"), y).astype(np.float32)
    y = _peaking(y, 3000, 4.5, 0.9)
    y = _peaking(y, 5200, 1.5, 1.2)
    # 4. Pushed: compression (more consistent, "leaning in") + light tanh saturation.
    y = _compress(y, thresh_db=-26, ratio=3.0)
    y = _saturate(y, 1.6)
    return _finish(y, ref, gain=1.25)


# -------------------------------------------------------------------------------------------- breathless
def _pink(n: int, rng: np.random.Generator) -> np.ndarray:
    w = rng.standard_normal(n + 64).astype(np.float32)
    f = np.fft.rfftfreq(len(w), 1 / SR)
    spec = np.fft.rfft(w) / np.sqrt(np.maximum(f, 40.0))
    return np.fft.irfft(spec, len(w))[:n].astype(np.float32)


def _breath(dur_s: float, kind: str, rng: np.random.Generator) -> np.ndarray:
    """Synthesised breath: pink noise through a breathy 'h' vocal-tract shape + an effortful envelope.

    inhale: brighter (turbulence at the lips/teeth), rises then cuts off as the next phrase starts.
    exhale: darker 'hhh', quick onset and a long tail.
    """
    n = max(int(dur_s * SR), 1)
    noise = _pink(n, rng)
    if kind == "inhale":
        bands = [(500, 1100, 0.6), (1300, 2600, 1.0), (2800, 5200, 0.55)]
    else:
        bands = [(300, 900, 1.0), (1000, 2000, 0.7), (2300, 4000, 0.3)]
    y = np.zeros(n, np.float32)
    for lo, hi, g in bands:
        y += g * sosfilt(butter(2, [lo, hi], "bandpass", fs=SR, output="sos"), noise).astype(np.float32)
    t = np.linspace(0, 1, n, dtype=np.float32)
    if kind == "inhale":
        env = np.sin(np.pi * np.clip(t / 0.8, 0, 1) / 2) ** 1.5 * np.clip((1 - t) / 0.2, 0, 1)
    else:
        env = np.clip(t / 0.12, 0, 1) * (1 - t) ** 1.6
    # a little flutter so it isn't a static hiss
    env = env * (1 + 0.15 * np.sin(2 * np.pi * rng.uniform(9, 13) * t * dur_s))
    y = y * env
    r = float(np.sqrt(np.mean(y ** 2))) or 1.0
    return (y / r).astype(np.float32)


def _breathless(x: np.ndarray, tempo: float, salt: str) -> np.ndarray:
    rng = _seed(x, salt)
    x = _trim_edges(x)
    ref = _active_rms(x)
    if tempo != 1.0:
        x = wsola(x, tempo)
    br = 0.28 * ref  # breath loudness relative to speech (about -11 dB)

    # Breathy voice: a bit of aspiration noise riding the speech envelope (high band only, so vowels stay clear).
    env = _envelope(x, 15.0)
    asp = sosfilt(butter(2, [1800, 6500], "bandpass", fs=SR, output="sos"), _pink(len(x), rng)).astype(np.float32)
    asp *= env / ((float(np.sqrt(np.mean(asp ** 2))) or 1.0))
    x = x + 0.10 * asp

    # Effort: slow amplitude tremor (~4 Hz, +/-8%).
    t = np.arange(len(x), dtype=np.float32) / SR
    x = x * (1 + 0.08 * np.sin(2 * np.pi * rng.uniform(3.6, 4.6) * t + rng.uniform(0, 6.28)))

    # Short breathy phrases: every internal pause becomes a gasp-for-air; pauses are stretched if a breath needs room.
    out = [_breath(rng.uniform(0.20, 0.26), "inhale", rng) * br * 0.9, np.zeros(int(0.03 * SR), np.float32)]
    prev = 0
    for s, e in _silences(x, 90):  # >=90 ms: real pauses, not plosive closures
        out.append(x[prev:s])
        gap = (e - s) / SR
        if gap >= 0.22:  # sentence-ish break: tired exhale, then a deeper inhale
            ex = _breath(rng.uniform(0.16, 0.22), "exhale", rng) * br * 0.8
            inh = _breath(rng.uniform(0.26, 0.34), "inhale", rng) * br
            out += [ex, np.zeros(int(0.03 * SR), np.float32), inh, np.zeros(int(0.03 * SR), np.float32)]
        else:  # comma-ish break: quick catch-breath
            inh = _breath(rng.uniform(0.17, 0.23), "inhale", rng) * br * 0.85
            out += [np.zeros(int(0.02 * SR), np.float32), inh, np.zeros(int(0.025 * SR), np.float32)]
        prev = e
    out.append(x[prev:])
    out.append(_breath(rng.uniform(0.22, 0.3), "exhale", rng) * br * 0.75)  # trailing 'hhh'
    y = np.concatenate(out).astype(np.float32)
    return _finish(y, ref, gain=1.0)


# --------------------------------------------------------------------------------------------- entry point
def apply(audio: np.ndarray, style: str, clone: bool, salt: str = "") -> np.ndarray:
    """Post-process one synthesised chunk (a sentence, or the whole line). calm is a no-op."""
    if style == "calm" or len(audio) < SR // 20:
        return audio
    a = np.asarray(audio, dtype=np.float32)
    if style == "fired":
        # Kokoro already ran at 1.13x natively; Chatterbox has no speed control, so stretch it here.
        return _fired(a, tempo=1.14 if clone else 1.0)
    if style == "breathless":
        return _breathless(a, tempo=1.05 if clone else 1.0, salt=salt)
    return a


_PHRASE_RE = re.compile(r"(?<=[,;:.!?\u2026])\s+")


def kokoro_phrases(text: str) -> list[tuple[str, float]]:
    """breathless + Kokoro: Kokoro barely pauses at commas, but it's cheap (~50 ms a call), so synthesise each
    phrase separately and join them with real gaps, which `apply` then fills with breaths.
    Returns [(phrase, gap_after_seconds)]."""
    parts = [p for p in _PHRASE_RE.split(text.strip()) if p.strip()]
    out = []
    for p in parts:
        gap = 0.28 if re.search(r"[.!?\u2026]$", p) else 0.14
        out.append((p, gap))
    return out
