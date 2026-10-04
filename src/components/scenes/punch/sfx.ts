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
 * Leather tearing: a crackle of tiny high-passed noise bursts at irregular intervals, layered on
 * top of a hit once the bag is badly damaged. `severity` is 0–1. Returns its length in seconds.
 */
export function synthRip(v: Voice, t: number, severity: number): number {
  const s = Math.max(0, Math.min(1, severity));
  const length = (0.12 + 0.1 * s) * rand(0.85, 1.15);
  const hp = filter(v, "highpass", rand(900, 1400), 0.7);
  const bp = filter(v, "bandpass", rand(2200, 3400), 0.9);
  hp.connect(bp);
  const bus = v.ctx.createGain();
  bus.gain.value = (0.32 + 0.22 * s) * rand(0.85, 1.05);
  bp.connect(bus).connect(v.out);
  let at = t + 0.012;
  while (at < t + length) {
    const grain = rand(0.003, 0.011);
    const g = v.ctx.createGain();
    const peak = rand(0.35, 1) * (1 - ((at - t) / length) * 0.6);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.0012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + grain);
    g.connect(hp);
    noise(v, at, grain + 0.002).connect(g);
    at += grain + rand(0.002, 0.018);
  }
  return length + 0.02;
}

/** The bag bursting: a deep boom, a stuffing whoomp and a long sand hiss. Returns its length in seconds. */
export function synthBurst(v: Voice, t: number): number {
  const boom = v.ctx.createOscillator();
  boom.type = "sine";
  boom.frequency.setValueAtTime(rand(95, 110), t);
  boom.frequency.exponentialRampToValueAtTime(rand(30, 36), t + 0.32);
  boom.connect(envelope(v, t, 0.55, 0.006, 0.34));
  boom.start(t);
  boom.stop(t + 0.4);

  const whoomp = filter(v, "lowpass", 1800, 0.9);
  whoomp.frequency.setValueAtTime(2200, t);
  whoomp.frequency.exponentialRampToValueAtTime(220, t + 0.25);
  noise(v, t, 0.3).connect(whoomp).connect(envelope(v, t, 0.42, 0.004, 0.26));

  // Sand pouring out: a soft hiss that swells then thins.
  const sand = filter(v, "bandpass", rand(4500, 6000), 0.8);
  const g = v.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.13, t + 0.14);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.48 + 0.3);
  g.connect(v.out);
  noise(v, t + 0.05, 0.47).connect(sand).connect(g);
  return 0.8;
}

/** One strike of a boxing ring bell: inharmonic partials with a long, bright decay. */
function bellStrike(v: Voice, t: number, level: number) {
  const base = rand(1180, 1240);
  const partials: [number, number, number][] = [[1, 1, 1.1], [2.76, 0.42, 0.7], [5.4, 0.22, 0.4], [8.93, 0.1, 0.22]];
  partials.forEach(([ratio, gain, decay]) => {
    const o = v.ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = base * ratio;
    o.connect(envelope(v, t, level * gain, 0.002, decay));
    o.start(t);
    o.stop(t + decay + 0.05);
  });
}

/** The KO bell: "ding-ding". Returns its length in seconds. */
export function synthBell(v: Voice, t: number): number {
  bellStrike(v, t, 0.12);
  bellStrike(v, t + 0.2, 0.105);
  return 0.2 + 1.15;
}

/** A fresh bag lowered in on its chain: a run of metallic clinks, then a clunk as it settles. */
export function synthClank(v: Voice, t: number): number {
  const clinks = 4 + Math.floor(Math.random() * 3);
  let at = t;
  for (let i = 0; i < clinks; i++) {
    const level = 0.24 * (0.55 + Math.random() * 0.45);
    noise(v, at, 0.03).connect(filter(v, "bandpass", rand(2600, 5200), rand(6, 12))).connect(envelope(v, at, level, 0.001, 0.035));
    [1, 2.31, 3.7].forEach((ratio, k) => {
      const o = v.ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = rand(1500, 2100) * ratio;
      o.connect(envelope(v, at, level * (0.09 / (k + 1)), 0.001, 0.06 + 0.03 * (2 - k)));
      o.start(at);
      o.stop(at + 0.15);
    });
    at += rand(0.035, 0.07);
  }
  // The bag's weight taking up the chain.
  const clunk = v.ctx.createOscillator();
  clunk.type = "sine";
  clunk.frequency.setValueAtTime(130, at);
  clunk.frequency.exponentialRampToValueAtTime(60, at + 0.1);
  clunk.connect(envelope(v, at, 0.28, 0.003, 0.11));
  clunk.start(at);
  clunk.stop(at + 0.15);
  return at - t + 0.16;
}

/**
 * Optional recorded samples (generated into public/sfx/ by the setup script). Any file that is
 * missing simply falls back to the synthesised sound above.
 */
const SAMPLE_FILES = {
  punch1: "/sfx/punch-1.mp3",
  punch2: "/sfx/punch-2.mp3",
  punch3: "/sfx/punch-3.mp3",
  uppercut: "/sfx/uppercut.mp3",
  burst: "/sfx/bag-burst.mp3",
  bell: "/sfx/bell.mp3",
  chain: "/sfx/chain.mp3",
  whoosh: "/sfx/whoosh.mp3",
} as const;
type SampleName = keyof typeof SAMPLE_FILES;

/**
 * Peak level (dBFS) each sample is normalised to at full strength, matching the synthesised
 * versions so a mix of samples and synth sounds stays balanced and modest under VENT's voice.
 */
const SAMPLE_PEAK_DB: Record<SampleName, number> = {
  punch1: -11, punch2: -11, punch3: -11, uppercut: -10, burst: -11, bell: -14, chain: -12, whoosh: -22,
};

type Sample = { buffer: AudioBuffer; gain: number; start: number; end: number };

/** Measures a decoded sample: its peak (for normalising) and where the audible part begins and ends. */
function analyse(buffer: AudioBuffer, peakDb: number): Sample | null {
  let peak = 0;
  let first = buffer.length;
  let last = 0;
  const threshold = 0.004; // ≈ -48 dBFS: below this counts as silence
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const a = Math.abs(data[i]);
      if (a > peak) peak = a;
      if (a > threshold) {
        if (i < first) first = i;
        if (i > last) last = i;
      }
    }
  }
  if (peak < threshold || last <= first) return null;
  const rate = buffer.sampleRate;
  return {
    buffer,
    gain: 10 ** (peakDb / 20) / peak,
    start: Math.max(0, first / rate - 0.002),
    end: Math.min(buffer.duration, last / rate + 0.02),
  };
}

/**
 * One AudioContext per Stage, created lazily on the first sound (the call was started by a click,
 * so the page already has user activation) and closed when the Stage unmounts.
 */
export class PunchSfx {
  private ctx: AudioContext | null = null;
  private voice: Voice | null = null;
  private closed = false;
  private samples = new Map<SampleName, Sample>();
  private sampleOut: GainNode | null = null;

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
        // Samples are peak-normalised already, so they skip the synth's master/limiter chain.
        this.sampleOut = ctx.createGain();
        this.sampleOut.gain.value = this.soft ? SOFT : 1;
        this.sampleOut.connect(ctx.destination);
        this.loadSamples(ctx);
      } catch {
        this.closed = true;
        return null;
      }
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    // Never queue sounds into a context that isn't running: they would all fire at once on resume.
    return this.ctx.state === "running" ? this.voice : null;
  }

  /** Fetches and decodes every sample once; missing or undecodable files are silently skipped. */
  private loadSamples(ctx: AudioContext) {
    (Object.keys(SAMPLE_FILES) as SampleName[]).forEach(async (name) => {
      try {
        const response = await fetch(SAMPLE_FILES[name]);
        if (!response.ok) return;
        const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        const sample = analyse(buffer, SAMPLE_PEAK_DB[name]);
        if (sample && !this.closed && this.ctx === ctx) this.samples.set(name, sample);
      } catch {
        // No sample: the synthesised sound is used instead.
      }
    });
  }

  /** Plays a loaded sample at context time `t`; returns its length in seconds, or 0 if it isn't available. */
  private play(name: SampleName, t: number, level = 1): number {
    const sample = this.samples.get(name);
    if (!sample || !this.ctx || !this.sampleOut) return 0;
    const src = this.ctx.createBufferSource();
    src.buffer = sample.buffer;
    src.playbackRate.value = 0.95 + Math.random() * 0.1;
    const g = this.ctx.createGain();
    g.gain.value = sample.gain * level;
    src.connect(g).connect(this.sampleOut);
    const length = sample.end - sample.start;
    src.start(t, sample.start, length);
    return length / src.playbackRate.value;
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
    const t = v.ctx.currentTime + 0.005;
    const p = Math.max(0, Math.min(1, power));
    const level = (0.55 + 0.45 * p) * (kind === "upper" ? 1 : kind === "cross" ? 0.86 : 0.74);
    let length = 0;
    if (kind === "upper") length = this.play("uppercut", t, level);
    if (!length) {
      const loaded = (["punch1", "punch2", "punch3"] as const).filter((name) => this.samples.has(name));
      if (loaded.length) length = this.play(loaded[Math.floor(Math.random() * loaded.length)], t, level);
    }
    return this.endsAt(length || synthHit(v, t, kind, power));
  }

  /** A feint through the air. Returns when the sound is over (performance.now() ms), or 0 if nothing played. */
  whoosh(power: number, delay = 0): number {
    const v = this.ready();
    if (!v) return 0;
    const t = v.ctx.currentTime + 0.005 + delay;
    return this.endsAt(delay + (this.play("whoosh", t, 0.6 + 0.4 * power) || synthWhoosh(v, t, power)));
  }

  /** A tearing layer, played alongside a hit once the bag is badly damaged. */
  rip(severity: number): number {
    const v = this.ready();
    if (!v) return 0;
    return this.endsAt(synthRip(v, v.ctx.currentTime + 0.01, severity));
  }

  /** The bag bursts, then the bell rings "ding-ding". */
  knockout(): number {
    const v = this.ready();
    if (!v) return 0;
    const t = v.ctx.currentTime + 0.01;
    const burst = this.play("burst", t) || synthBurst(v, t);
    const bell = 0.32 + (this.play("bell", t + 0.32) || synthBell(v, t + 0.32));
    return this.endsAt(Math.max(burst, bell));
  }

  /** Chain clinks as a fresh bag is lowered in, starting `delay` seconds from now. */
  clank(delay = 0): number {
    const v = this.ready();
    if (!v) return 0;
    const t = v.ctx.currentTime + 0.01 + delay;
    return this.endsAt(delay + (this.play("chain", t) || synthClank(v, t)));
  }

  close() {
    this.closed = true;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.voice = null;
    this.sampleOut = null;
    this.samples.clear();
  }
}
