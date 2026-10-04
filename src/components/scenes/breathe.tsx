import { useEffect, useRef } from "react";
import type { ListenerTone } from "@/lib/types";
import type { SceneModule, SceneProps } from "./types";
import { Spirit } from "./breathe/spirit";
import styles from "./breathe.module.css";

/** Seconds for one inhale / one exhale. Tense callers get a slower, longer exhale to calm down. */
const TEMPO: Record<ListenerTone | "none", [number, number]> = {
  none: [4, 6],
  calm: [4, 6],
  bright: [4, 5.5],
  fired_up: [4, 6.5],
  heavy: [4.5, 7],
  tense: [5, 8],
};

const CAPTIONS = [
  { key: "in", text: "breathe in" },
  { key: "out", text: "breathe out" },
  { key: "go", text: "let it all out" },
  { key: "think", text: "sitting with that…" },
  { key: "settle", text: "settling in" },
  { key: "mute", text: "on mute · just breathe" },
] as const;

type CaptionKey = (typeof CAPTIONS)[number]["key"];

const ease = (x: number) => 0.5 - Math.cos(Math.PI * x) / 2;

/** Deterministic pseudo-random so server and client render the same particles. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const rand = seeded(7);
const MOTES = Array.from({ length: 22 }, (_, index) => ({
  left: rand() * 100,
  size: 3 + rand() * 6,
  duration: 16 + rand() * 18,
  delay: -rand() * 34,
  sway: (rand() - 0.5) * 60,
  petal: index % 4 === 0,
  hue: index % 3,
}));

function Backdrop({ muted }: SceneProps) {
  return (
    <div className={styles.backdrop} data-muted={muted || undefined}>
      <div className={`${styles.blob} ${styles.blob1}`} />
      <div className={`${styles.blob} ${styles.blob2}`} />
      <div className={`${styles.blob} ${styles.blob3}`} />
      <div className={`${styles.blob} ${styles.blob4}`} />
      <div className={styles.veil} />
      <div className={styles.motes}>
        {MOTES.map((mote, index) => (
          <span
            key={index}
            className={mote.petal ? styles.petal : styles.mote}
            data-hue={mote.hue}
            style={{
              left: `${mote.left}%`,
              width: mote.petal ? mote.size * 2.2 : mote.size,
              height: mote.petal ? mote.size * 1.5 : mote.size,
              animationDuration: `${mote.duration}s`,
              animationDelay: `${mote.delay}s`,
              ["--sway" as string]: `${mote.sway}px`,
            }}
          />
        ))}
      </div>
      <div className={styles.grain} />
    </div>
  );
}

function Stage({ phase, tone, muted, subscribeLevel }: SceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const ringRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const rippleRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const live = useRef({ phase, tone, muted });

  useEffect(() => {
    live.current = { phase, tone, muted };
  }, [phase, tone, muted]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let last = performance.now();
    let inhaling = true;
    let progress = 0;
    let level = 0;
    let smooth = 0;
    let caption: CaptionKey | null = null;
    let lastRipple = 0;
    let rippleIndex = 0;
    const rings = [0.5, 0.5, 0.5];

    const unsubscribe = subscribeLevel((value) => {
      level = value;
      const now = performance.now();
      if (reduced.matches || value < 0.16 || now - lastRipple < 420) return;
      const ripple = rippleRefs.current[rippleIndex % rippleRefs.current.length];
      rippleIndex += 1;
      lastRipple = now;
      ripple?.animate(
        [
          { transform: "translate(-50%, -50%) scale(.92)", opacity: Math.min(0.85, 0.3 + value) },
          { transform: `translate(-50%, -50%) scale(${1.7 + value * 0.7})`, opacity: 0 },
        ],
        { duration: 2000 + value * 600, easing: "cubic-bezier(.16,.7,.3,1)" },
      );
    });

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { phase: currentPhase, tone: currentTone, muted: isMuted } = live.current;
      const [inhale, exhale] = TEMPO[currentTone ?? "none"];
      progress += dt / (inhaling ? inhale : exhale);
      if (progress >= 1) {
        progress = 0;
        inhaling = !inhaling;
      }
      const breath = reduced.matches ? 0.5 : inhaling ? ease(progress) : 1 - ease(progress);
      smooth += (level - smooth) * (level > smooth ? 0.3 : 0.06);

      root.style.setProperty("--breath", breath.toFixed(4));
      root.style.setProperty("--lvl", smooth.toFixed(4));
      root.style.setProperty("--trail", (inhaling ? progress : 1 - progress).toFixed(4));

      // Halo rings follow the breath with increasing lag, and swell with the caller's voice.
      rings.forEach((value, index) => {
        rings[index] = value + (breath - value) * (0.09 - index * 0.025);
        const ring = ringRefs.current[index];
        if (!ring) return;
        const scale = 0.84 + rings[index] * 0.2 + smooth * (0.05 + index * 0.05);
        ring.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(4)})`;
      });

      const next: CaptionKey = isMuted
        ? "mute"
        : currentPhase === "connecting" || currentPhase === "ringing" || currentPhase === "error"
          ? "settle"
          : currentPhase === "hearing"
            ? "go"
            : currentPhase === "thinking"
              ? "think"
              : inhaling
                ? "in"
                : "out";
      if (next !== caption) {
        caption = next;
        root.dataset.caption = next;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [subscribeLevel]);

  return (
    <div ref={rootRef} className={styles.stage} data-phase={phase} data-muted={muted || undefined}>
      <div className={styles.orbit}>
        <span className={styles.sun} />
        {[0, 1, 2].map((index) => (
          <span key={index} ref={(node) => { ringRefs.current[index] = node; }} className={styles.ring} data-ring={index} />
        ))}
        {[0, 1, 2, 3, 4].map((index) => (
          <span key={index} ref={(node) => { rippleRefs.current[index] = node; }} className={styles.ripple} />
        ))}
        <Spirit />
      </div>
      <div className={styles.guide} aria-hidden="true">
        <div className={styles.words}>
          {CAPTIONS.map((caption) => (
            <span key={caption.key} data-key={caption.key}>{caption.text}</span>
          ))}
        </div>
        <div className={styles.meter}><i /></div>
      </div>
    </div>
  );
}

function CoverArt() {
  return (
    <div className={styles.cover} aria-hidden="true">
      <span className={styles.coverGlow} />
      <Spirit />
    </div>
  );
}

export const breathe: SceneModule = {
  Backdrop,
  Stage,
  theme: styles.theme,
  CoverArt,
  cover: { background: "#f0c947", ink: "#25302b" },
  kicker: "BREATHE IT OUT",
};
