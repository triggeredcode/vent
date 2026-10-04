/**
 * Workout foley for the SWEAT scene, synthesized with Web Audio (no files). Deliberately quiet and soft:
 *   rep()      a low, airy "hff" exhale (short band-limited breath), peak ≈ −24 dBFS
 *   setDone()  a warm two-note chime (sine + a whisper of octave), peak ≈ −22 dBFS
 * No compressor and no metallic partials: every voice has a slow-ish attack and a low-passed body so
 * nothing clicks, crunches or screeches. Each call is lightly randomized so it never sounds looped.
 *
 * Feedback guard: the rep tempo follows the caller's mic level and speaker output can leak into the mic.
 * `sounding()` is true while a sound (plus a short tail) is playing; the stage ignores level *rises*
 * during that window so the buddy never cheers itself on.
 */

/** −24 dBFS and −22 dBFS as linear amplitude. */
const EXHALE_PEAK = 0.063;
const CHIME_PEAK = 0.079;
/** How long after a sound starts the mic level is treated as suspect (sound + room tail). */
const GUARD_MS = 250;

const jitter = (amount: number) => 1 + (Math.random() * 2 - 1) * amount;

type Ctx = BaseAudioContext;

let noiseCache: WeakMap<Ctx, AudioBuffer> | null = null;
/** Half a second of soft (brown-ish) noise, normalised to ±1 so gain stages map straight to dBFS. */
function noise(ctx: Ctx) {
  noiseCache ??= new WeakMap();
  let buffer = noiseCache.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    let max = 0;
    for (let index = 0; index < data.length; index += 1) {
      last = last * 0.82 + (Math.random() * 2 - 1) * 0.18;
      data[index] = last;
      max = Math.max(max, Math.abs(last));
    }
    for (let index = 0; index < data.length; index += 1) data[index] /= max || 1;
    noiseCache.set(ctx, buffer);
  }
  return buffer;
}

/** Effort exhale: ~150 ms of low band-passed breath, 18 ms fade-in, soft decay. `power` 0–1 adds a touch of air. */
export function exhale(ctx: Ctx, out: AudioNode, at: number, power = 0.5) {
  const duration = (0.13 + power * 0.04) * jitter(0.12);
  const source = ctx.createBufferSource();
  source.buffer = noise(ctx);
  source.playbackRate.value = jitter(0.06);
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  const centre = (520 + power * 160) * jitter(0.12); // a low "hff", not a hiss
  band.frequency.setValueAtTime(centre * 1.1, at);
  band.frequency.exponentialRampToValueAtTime(centre * 0.75, at + duration);
  band.Q.value = 0.8;
  const air = ctx.createBiquadFilter();
  air.type = "lowpass";
  air.frequency.value = 1800;
  const gain = ctx.createGain();
  // The band-pass costs ~5–8 dB of the normalised noise; the make-up lands the loudest of 30 random
  // renders at ≈ −26 dBFS (soft) … −24 dBFS (hard) (OfflineAudioContext check).
  const peak = EXHALE_PEAK * 1.8 * (0.85 + power * 0.15) * jitter(0.06);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.018);
  gain.gain.exponentialRampToValueAtTime(peak * 0.4, at + duration * 0.55);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(band).connect(air).connect(gain).connect(out);
  source.start(at, Math.random() * 0.3, duration + 0.03);
}

/** Set complete: two warm notes a fourth or fifth apart (E5/A5 or C5/G5 region), soft attack, gentle ring. */
export function chime(ctx: Ctx, out: AudioNode, at: number) {
  const pairs: [number, number][] = [[523.25, 783.99], [587.33, 880], [659.25, 880]];
  const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
  [a, b].forEach((freq, index) => {
    const start = at + index * 0.12;
    const length = index ? 0.55 : 0.32;
    // Two overlapping notes plus the octave partial stay under the −22 dBFS budget.
    const level = CHIME_PEAK * (index ? 0.8 : 0.62);
    [[1, 1], [2, 0.12]].forEach(([mult, amp]) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * mult * jitter(0.002);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(level * amp, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      osc.connect(gain).connect(out);
      osc.start(start);
      osc.stop(start + length + 0.03);
    });
  });
}

export interface Sfx {
  /** A rep was completed while the caller was talking. `power` 0–1 scales the effort a little. */
  rep: (power: number) => void;
  /** Ten reps done. */
  setDone: () => void;
  /** True while our own sound may be leaking into the mic. */
  sounding: () => boolean;
  dispose: () => void;
}

/** One lazily created AudioContext per scene; nothing is created until the first sound. */
export function createSfx(): Sfx {
  let ctx: AudioContext | null = null;
  let guardUntil = 0;
  let disposed = false;

  const ready = () => {
    if (disposed || typeof window === "undefined" || !("AudioContext" in window)) return null;
    // The call starts from a click; without any user activation the browser would block (and warn).
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (activation && !activation.hasBeenActive) return null;
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    return ctx.state === "closed" ? null : ctx;
  };

  const play = (fn: (c: AudioContext, out: AudioNode, at: number) => void, guard = GUARD_MS) => {
    const c = ready();
    if (!c) return;
    fn(c, c.destination, c.currentTime + 0.01);
    guardUntil = Math.max(guardUntil, performance.now() + guard);
  };

  return {
    rep: (power) => play((c, out, at) => exhale(c, out, at, Math.min(1, Math.max(0, power)))),
    setDone: () => play((c, out, at) => chime(c, out, at + 0.1), GUARD_MS + 500),
    sounding: () => performance.now() < guardUntil,
    dispose: () => {
      disposed = true;
      if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
      ctx = null;
    },
  };
}
