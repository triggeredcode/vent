/**
 * Workout foley for the SWEAT scene, synthesized with Web Audio (no files):
 *   rep()      effort exhale ("hff": band-passed noise) + a light metallic tink/creak from the bar
 *   setDone()  a short, bright two-note chime every completed set
 * Every call is slightly randomized so it never repeats identically. Peak output sits around −12 dBFS.
 *
 * Feedback guard: the scene's rep tempo follows the caller's mic level, and speaker output can leak
 * into the mic. `sounding()` is true while a sound (plus a short tail) is playing; the stage ignores
 * level *increases* during that window so the buddy never speeds itself up.
 */

/** Make-up gain after the limiter, tuned (OfflineAudioContext) so a hard rep / the chime peak near −12 dBFS. */
const MASTER = 0.45;
/** How long after a sound starts the mic level is treated as suspect (sound + room tail). */
const GUARD_MS = 250;

const jitter = (amount: number) => 1 + (Math.random() * 2 - 1) * amount;

type Ctx = BaseAudioContext;

let noiseCache: WeakMap<Ctx, AudioBuffer> | null = null;
function noise(ctx: Ctx) {
  noiseCache ??= new WeakMap();
  let buffer = noiseCache.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Slightly pink (one-pole low-pass on white) so the breath sounds airy, not hissy.
    let last = 0;
    for (let index = 0; index < data.length; index += 1) {
      last = last * 0.55 + (Math.random() * 2 - 1) * 0.45;
      data[index] = last * 1.6;
    }
    noiseCache.set(ctx, buffer);
  }
  return buffer;
}

/** Effort exhale: ~180 ms of band-passed noise, a fast attack and a breathy decay. */
export function exhale(ctx: Ctx, out: AudioNode, at: number, power = 0.5) {
  const duration = 0.18 * jitter(0.15);
  const source = ctx.createBufferSource();
  source.buffer = noise(ctx);
  source.playbackRate.value = jitter(0.08);
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  const centre = (850 + power * 350) * jitter(0.2); // ~600–1500 Hz
  band.frequency.setValueAtTime(centre * 1.15, at);
  band.frequency.exponentialRampToValueAtTime(centre * 0.8, at + duration);
  band.Q.value = 1.1 * jitter(0.25);
  const gain = ctx.createGain();
  const peak = (0.5 + power * 0.5) * jitter(0.1);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.014);
  gain.gain.exponentialRampToValueAtTime(peak * 0.35, at + duration * 0.45);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(band).connect(gain).connect(out);
  const offset = Math.random() * 0.3;
  source.start(at, offset, duration + 0.02);
}

/** The bar: a couple of inharmonic partials that ring briefly, sometimes with a low creak under them. */
export function tink(ctx: Ctx, out: AudioNode, at: number, power = 0.5) {
  const base = 1650 * jitter(0.06);
  const level = (0.16 + power * 0.12) * jitter(0.15);
  [[1, 1, 0.16], [2.76, 0.45, 0.09], [5.4, 0.22, 0.05]].forEach(([ratio, amp, decay]) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = base * ratio * jitter(0.004);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level * amp, at + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay * jitter(0.15));
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + decay * 1.2 + 0.02);
  });
  if (Math.random() < 0.45) {
    // Creak: a low sawtooth wobbling through a narrow band, like the bar flexing in its mounts.
    const creak = ctx.createOscillator();
    creak.type = "sawtooth";
    const start = at + 0.02;
    const length = 0.07 * jitter(0.25);
    creak.frequency.setValueAtTime(70 * jitter(0.2), start);
    creak.frequency.linearRampToValueAtTime(110 * jitter(0.2), start + length);
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 650 * jitter(0.2);
    band.Q.value = 4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.09 * jitter(0.2), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    creak.connect(band).connect(gain).connect(out);
    creak.start(start);
    creak.stop(start + length + 0.02);
  }
}

/** Set complete: two bright notes a fifth (or fourth) apart, bell-ish with a quick decay. */
export function chime(ctx: Ctx, out: AudioNode, at: number) {
  const roots = [1046.5, 1174.7, 1318.5]; // C6, D6, E6
  const root = roots[Math.floor(Math.random() * roots.length)];
  const interval = Math.random() < 0.7 ? 1.5 : 4 / 3;
  [root, root * interval].forEach((freq, index) => {
    const start = at + index * 0.11;
    const length = index ? 0.42 : 0.24;
    const level = index ? 0.32 : 0.26;
    [[1, "triangle", 1], [2, "sine", 0.25]].forEach(([mult, type, amp]) => {
      const osc = ctx.createOscillator();
      osc.type = type as OscillatorType;
      osc.frequency.value = freq * (mult as number) * jitter(0.003);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(level * (amp as number), start + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      osc.connect(gain).connect(out);
      osc.start(start);
      osc.stop(start + length + 0.02);
    });
  });
}

/** Builds the master chain (gentle compressor → master gain). Exported so offline checks use the same path. */
export function chain(ctx: Ctx) {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -8;
  comp.knee.value = 8;
  comp.ratio.value = 12;
  comp.attack.value = 0.002;
  comp.release.value = 0.12;
  const master = ctx.createGain();
  master.gain.value = MASTER;
  comp.connect(master).connect(ctx.destination);
  return comp;
}

export interface Sfx {
  /** One rep at the top of the pull. `power` 0–1 scales the effort. */
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
  let input: AudioNode | null = null;
  let guardUntil = 0;
  let disposed = false;

  const ready = () => {
    if (disposed || typeof window === "undefined" || !("AudioContext" in window)) return null;
    // The call starts from a click; without any user activation the browser would block (and warn).
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (activation && !activation.hasBeenActive) return null;
    if (!ctx) {
      ctx = new AudioContext();
      input = chain(ctx);
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    return ctx.state === "closed" ? null : ctx;
  };

  const play = (fn: (c: AudioContext, out: AudioNode, at: number) => void, guard = GUARD_MS) => {
    const c = ready();
    if (!c || !input) return;
    fn(c, input, c.currentTime + 0.005);
    guardUntil = Math.max(guardUntil, performance.now() + guard);
  };

  return {
    rep: (power) => play((c, out, at) => {
      const p = Math.min(1, Math.max(0, power));
      exhale(c, out, at, p);
      tink(c, out, at + 0.015 * Math.random(), p);
    }),
    setDone: () => play((c, out, at) => chime(c, out, at + 0.12), GUARD_MS + 450),
    sounding: () => performance.now() < guardUntil,
    dispose: () => {
      disposed = true;
      if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
      ctx = null;
      input = null;
    },
  };
}
