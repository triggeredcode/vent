/**
 * Heavy-bag punch sounds, synthesised with the Web Audio API (no audio files).
 *
 * A landed punch is four layers, all scheduled on the same instant:
 *   1. thump  – a sine whose pitch falls ~140 → 45 Hz over ~120 ms (the bag's body), plus a short
 *               triangle "knock" an octave up so it still reads on phone speakers;
 *   2. slap   – ~30 ms of band-passed noise (1–3 kHz): glove leather meeting bag leather;
 *   3. thud   – ~70 ms of low-passed noise for texture under the thump;
 *   4. rattle – on bigger hits, a few faint high metallic ticks from the chain.
 * Uppercuts are deeper, longer and louder. Every parameter is jittered so a flurry never sounds
 * machine-gun identical. Everything runs through a gain + limiter so peaks sit around -10 dBFS.
 */

export type PunchSound = "jab" | "cross" | "upper";

/** Master level. With the layer gains below a full-power uppercut peaks around -10 dBFS. */
const LEVEL = 0.6;
/** prefers-reduced-motion: still audible, just gentler. */
const SOFT = 0.55;

type Voice = { ctx: BaseAudioContext; out: AudioNode; noise: AudioBuffer };

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Half a second of white noise, generated once per context (≈ 90 KB). */
export function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 0.5);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Master gain → safety limiter → speakers. Returns the node the voices connect to. */
export function buildChain(ctx: BaseAudioContext, level: number): AudioNode {
  const master = ctx.createGain();
  master.gain.value = level;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 2;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.08;
  master.connect(limiter).connect(ctx.destination);
  return master;
}

/** Exponential attack/decay envelope on a fresh gain node. */
function envelope(v: Voice, t: number, peak: number, attack: number, decay: number): GainNode {
  const g = v.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(v.out);
  return g;
}

/** A slice of the noise buffer starting at a random offset, so no two bursts are the same. */
function noise(v: Voice, t: number, duration: number): AudioBufferSourceNode {
  const src = v.ctx.createBufferSource();
  src.buffer = v.noise;
  src.start(t, rand(0, Math.max(0, v.noise.duration - duration - 0.01)), duration + 0.01);
  return src;
}

function filter(v: Voice, type: BiquadFilterType, frequency: number, q: number): BiquadFilterNode {
  const f = v.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = q;
  return f;
}

/**
 * Schedules one landed punch at context time `t`. `power` is 0–1.
 * Returns how long (seconds) the sound lasts from `t`.
 */
export function synthHit(v: Voice, t: number, kind: PunchSound, power: number): number {
  const p = Math.max(0, Math.min(1, power));
  const heavy = kind === "upper" ? 1 : kind === "cross" ? 0.5 : 0.2;
  const big = kind === "upper" || p > 0.78;
  const loud = (0.55 + 0.45 * p) * (kind === "upper" ? 1 : kind === "cross" ? 0.86 : 0.74) * rand(0.86, 1.06);
  const pitch = rand(0.92, 1.08);
  const dur = (0.115 + 0.06 * heavy) * rand(0.9, 1.1);
  const f0 = (142 - 26 * heavy) * pitch;
  const f1 = (46 - 9 * heavy) * pitch;

  // 1. Thump: falling sine, the bag's body.
  const body = v.ctx.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(f0, t);
  body.frequency.exponentialRampToValueAtTime(f1, t + dur);
  body.connect(envelope(v, t, 0.95 * loud, 0.004, dur));
  body.start(t);
  body.stop(t + dur + 0.03);

  // ... with a short triangle knock on top, which small speakers can actually reproduce.
  const knock = v.ctx.createOscillator();
  knock.type = "triangle";
  knock.frequency.setValueAtTime(f0 * 1.9, t);
  knock.frequency.exponentialRampToValueAtTime(f1 * 1.7, t + dur * 0.5);
  knock.connect(envelope(v, t, 0.2 * loud, 0.003, dur * 0.5));
  knock.start(t);
  knock.stop(t + dur * 0.5 + 0.03);

  // 2. Slap: band-passed noise transient, glove leather on bag leather.
  const slapLength = rand(0.024, 0.036);
  noise(v, t, slapLength + 0.01)
    .connect(filter(v, "bandpass", rand(1100, 2900) * (1 - 0.3 * heavy), rand(0.7, 1.2)))
    .connect(envelope(v, t, (0.75 + 0.35 * p) * loud, 0.0015, slapLength));

  // 3. Thud: low noise for the stuffing inside the bag.
  noise(v, t, 0.09)
    .connect(filter(v, "lowpass", rand(240, 360) - 60 * heavy, 0.8))
    .connect(envelope(v, t, 0.55 * loud, 0.003, 0.07 + 0.03 * heavy));

  let end = dur + 0.03;

  // 4. Chain rattle on the bigger hits: a few faint high ticks as the links settle.
  if (big || p > 0.6) {
    const ticks = big ? 4 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 2);
    let at = t + rand(0.035, 0.06);
    for (let i = 0; i < ticks; i++) {
      const fade = 1 - i / (ticks + 1);
      noise(v, at, 0.02)
        .connect(filter(v, "bandpass", rand(3600, 7200), rand(5, 9)))
        .connect(envelope(v, at, 0.22 * loud * fade, 0.001, 0.014));
      const ping = v.ctx.createOscillator();
      ping.type = "sine";
      ping.frequency.value = rand(2300, 4200);
      ping.connect(envelope(v, at, 0.018 * loud * fade, 0.001, 0.03));
      ping.start(at);
      ping.stop(at + 0.04);
      at += rand(0.022, 0.038);
    }
    end = Math.max(end, at - t + 0.03);
  }
  return end;
}

/** A quiet glove whoosh through the air (a feint that doesn't land). Returns its length in seconds. */
export function synthWhoosh(v: Voice, t: number, power: number): number {
  const length = rand(0.16, 0.21);
  const bp = filter(v, "bandpass", 450, rand(1.1, 1.6));
  bp.frequency.setValueAtTime(rand(380, 520), t);
  bp.frequency.exponentialRampToValueAtTime(rand(1500, 2100), t + length * 0.45);
  bp.frequency.exponentialRampToValueAtTime(rand(550, 750), t + length);
  const g = v.ctx.createGain();
  const peak = (0.16 + 0.12 * power) * rand(0.85, 1.1);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + length * 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  g.connect(v.out);
  noise(v, t, length).connect(bp).connect(g);
  return length;
}

/**
 * One AudioContext per Stage, created lazily on the first sound (the call was started by a click,
 * so the page already has user activation) and closed when the Stage unmounts.
 */
export class PunchSfx {
  private ctx: AudioContext | null = null;
  private voice: Voice | null = null;
  private closed = false;

  constructor(private readonly soft = false) {}

  private ready(): Voice | null {
    if (this.closed || typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        const ctx = new Ctor({ latencyHint: "interactive" });
        this.ctx = ctx;
        this.voice = { ctx, out: buildChain(ctx, LEVEL * (this.soft ? SOFT : 1)), noise: makeNoise(ctx) };
      } catch {
        this.closed = true;
        return null;
      }
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    // Never queue sounds into a context that isn't running: they would all fire at once on resume.
    return this.ctx.state === "running" ? this.voice : null;
  }

  /** performance.now() time at which a sound of `seconds`, starting now, has fully left the speakers. */
  private endsAt(seconds: number): number {
    const ctx = this.ctx!;
    const latency = Math.min(0.3, (ctx.baseLatency || 0) + (ctx.outputLatency || 0));
    return performance.now() + (seconds + latency) * 1000 + 40;
  }

  /** A landed punch. Returns when the sound is over (performance.now() ms), or 0 if nothing played. */
  hit(kind: PunchSound, power: number): number {
    const v = this.ready();
    if (!v) return 0;
    return this.endsAt(synthHit(v, v.ctx.currentTime + 0.005, kind, power));
  }

  /** A feint through the air. Returns when the sound is over (performance.now() ms), or 0 if nothing played. */
  whoosh(power: number, delay = 0): number {
    const v = this.ready();
    if (!v) return 0;
    return this.endsAt(delay + synthWhoosh(v, v.ctx.currentTime + 0.005 + delay, power));
  }

  close() {
    this.closed = true;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.voice = null;
  }
}
