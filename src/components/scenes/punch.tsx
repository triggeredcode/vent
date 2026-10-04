import { Anton, Oswald } from "next/font/google";
import { useEffect, useId, useRef } from "react";
import type { SceneModule, SceneProps } from "./types";
import { armPath, Devil, DevilDefs, GUARD, gloveTransform, HIP, SHOULDER, type Point } from "./punch/devil";
import styles from "./punch.module.css";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--punch-anton", display: "swap" });
const oswald = Oswald({ weight: ["500", "600", "700"], subsets: ["latin"], variable: "--punch-oswald", display: "swap" });
const fonts = `${anton.variable} ${oswald.variable}`;

/* ───────────── Shared impact bus: the stage throws punches, the backdrop feels them ───────────── */
type Impact = { power: number; big: boolean };
const impactBus = new Set<(impact: Impact) => void>();

/* ───────────── Stage geometry (viewBox 0 0 400 400) ───────────── */
const DEVIL_X = 132;
const FLOOR_Y = 374;
const BAG_X = 318;
const BAG_PIVOT_Y = -150;
const BAG_LEFT = BAG_X - 42;
/** Where a glove's centre lands when it meets the bag, in the devil's local space. */
const CONTACT_X = BAG_LEFT - DEVIL_X - 24;

type PunchKind = "jab" | "cross" | "upper";
type ArmKey = "lead" | "rear";
type ArmState = { kind: PunchKind | null; t0: number; dur: number; power: number; landed: boolean; air: boolean; idle: boolean };

const PUNCHES: Record<PunchKind, { dur: number; target: Point; windup: Point; lean: number; spin: number; push: number }> = {
  jab: { dur: 230, target: { x: CONTACT_X, y: -170 }, windup: { x: -10, y: 3 }, lean: 5, spin: 0, push: 0.7 },
  cross: { dur: 270, target: { x: CONTACT_X, y: -158 }, windup: { x: -14, y: 4 }, lean: 10, spin: 0, push: 1 },
  upper: { dur: 360, target: { x: CONTACT_X - 4, y: -200 }, windup: { x: -8, y: 34 }, lean: 12, spin: -58, push: 1.55 },
};

const POW_WORDS = { small: ["POW!", "BAM!", "WHAP!", "BIFF!", "SMACK!"], big: ["KAPOW!", "WHAM!", "BOOM!", "KRAK!"] };

/** A jagged comic burst, generated once. */
const BURST = Array.from({ length: 28 }, (_, i) => {
  const r = i % 2 === 0 ? 56 + ((i * 37) % 11) : 30 + ((i * 13) % 7);
  const a = (i / 28) * Math.PI * 2;
  return `${(Math.cos(a) * r * 1.25).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
}).join(" ");

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Glove extension over a punch: wind-up (negative), snap out, hold on contact, pull back. */
function extension(p: number) {
  if (p < 0.16) return -(p / 0.16);
  if (p < 0.42) return easeOut((p - 0.16) / 0.26);
  if (p < 0.56) return 1;
  return 1 - easeInOut(Math.min(1, (p - 0.56) / 0.44));
}

function useUid() {
  return `pd${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}

function poseOf(phase: SceneProps["phase"]) {
  if (phase === "speaking") return "speak";
  if (phase === "thinking" || phase === "error") return "think";
  if (phase === "connecting" || phase === "ringing") return "warm";
  return "fight";
}

function rotateAround(p: Point, pivot: Point, deg: number): Point {
  const r = (deg * Math.PI) / 180;
  const dx = p.x - pivot.x;
  const dy = p.y - pivot.y;
  return { x: pivot.x + dx * Math.cos(r) - dy * Math.sin(r), y: pivot.y + dx * Math.sin(r) + dy * Math.cos(r) };
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ───────────── Backdrop ───────────── */

const EMBERS = Array.from({ length: 30 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  size: 2 + ((i * 7) % 4),
  delay: -((i * 0.73) % 7),
  duration: 4.5 + ((i * 1.7) % 4),
  drift: ((i * 29) % 60) - 30,
}));
const FLAMES = Array.from({ length: 9 }, (_, i) => ({
  left: -8 + i * 13,
  height: 26 + ((i * 17) % 22),
  width: 30 + ((i * 11) % 16),
  delay: -((i * 0.37) % 1.6),
  duration: 1.1 + ((i * 0.29) % 0.9),
}));

function PunchBackdrop({ tone, muted }: SceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduced = prefersReducedMotion();
    const onImpact = ({ power, big }: Impact) => {
      if (reduced) return;
      const s = (big ? 9 : 4) * (0.6 + power);
      rootRef.current?.animate([
        { transform: "translate(0,0)" },
        { transform: `translate(${s}px,${-s * 0.6}px)` },
        { transform: `translate(${-s * 0.8}px,${s * 0.5}px)` },
        { transform: `translate(${s * 0.4}px,${s * 0.3}px)` },
        { transform: "translate(0,0)" },
      ], { duration: big ? 300 : 200, easing: "ease-out" });
      flashRef.current?.animate([{ opacity: big ? 1 : 0.55 }, { opacity: 0 }], { duration: big ? 520 : 320, easing: "ease-out" });
    };
    impactBus.add(onImpact);
    return () => { impactBus.delete(onImpact); };
  }, []);

  return <div ref={rootRef} className={`${styles.backdrop} ${fonts} ${muted ? styles.isMuted : ""}`} data-tone={tone ?? "none"}>
    <div className={styles.heat} />
    <div className={styles.halftone} />
    <div className={styles.bigType}>DEVIL</div>
    <div className={styles.spot} />
    <div className={styles.flames}>
      {FLAMES.map((f, i) => <span key={i} style={{ left: `${f.left}%`, height: `${f.height}%`, width: `${f.width}%`, animationDelay: `${f.delay}s`, animationDuration: `${f.duration}s` }} />)}
    </div>
    <div className={styles.embers}>
      {EMBERS.map((e, i) => <span key={i} style={{ left: `${e.left}%`, width: e.size, height: e.size, animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s`, ["--drift" as string]: `${e.drift}px` }} />)}
    </div>
    <div className={styles.vignette} />
    <div ref={flashRef} className={styles.flash} />
  </div>;
}

/* ───────────── Stage ───────────── */

function PunchStage({ phase, tone, muted, subscribeLevel }: SceneProps) {
  const uid = useUid();
  const live = useRef({ phase, tone, muted });
  useEffect(() => { live.current = { phase, tone, muted }; }, [phase, tone, muted]);

  const rootRef = useRef<HTMLDivElement>(null);
  const devilRef = useRef<SVGGElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);
  const bagRef = useRef<SVGGElement>(null);
  const bagBodyRef = useRef<SVGGElement>(null);
  const bagShadowRef = useRef<SVGEllipseElement>(null);
  const dentRef = useRef<SVGEllipseElement>(null);
  const powRef = useRef<SVGGElement>(null);
  const powInnerRef = useRef<SVGGElement>(null);
  const powTextRef = useRef<SVGTextElement>(null);
  const hitsRef = useRef<HTMLSpanElement>(null);
  const comboRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    const part = (name: string) => devilRef.current?.querySelector<SVGGElement>(`[data-part="${name}"]`) ?? null;
    const [upperEl, headEl, tailEl, browsEl, leadArmEl, rearArmEl, leadGloveEl, rearGloveEl, leadStreakEl, rearStreakEl] =
      ["upper", "head", "tail", "brows", "leadArm", "rearArm", "leadGlove", "rearGlove", "leadStreak", "rearStreak"].map(part);
    const arms: Record<ArmKey, ArmState> = {
      lead: { kind: null, t0: 0, dur: 1, power: 0, landed: false, air: false, idle: false },
      rear: { kind: null, t0: 0, dur: 1, power: 0, landed: false, air: false, idle: false },
    };
    const gloves: Record<ArmKey, Point> = { lead: { ...GUARD.fight.lead }, rear: { ...GUARD.fight.rear } };
    const bag = { angle: 0, velocity: 0, squash: 0 };
    let hits = 0;
    let combo = 0;
    let lastHit = 0;
    let lastPunch = 0;
    let nextLead: ArmKey = "lead";
    let nextIdle = performance.now() + 1200;
    let prevLevel = 0;
    let lean = 0;
    let wordIndex = 0;
    let frame = 0;
    let last = performance.now();

    const throwPunch = (kind: PunchKind, power: number, opts: { air?: boolean; idle?: boolean } = {}) => {
      const now = performance.now();
      let key: ArmKey = kind === "upper" ? "rear" : kind === "jab" ? "lead" : "rear";
      if (arms[key].kind) key = key === "lead" ? "rear" : "lead";
      if (arms[key].kind) return false;
      const slow = opts.air ? 1.45 : 1;
      arms[key] = { kind, t0: now, dur: PUNCHES[kind].dur * slow, power, landed: false, air: !!opts.air, idle: !!opts.idle };
      lastPunch = now;
      return true;
    };

    const land = (arm: ArmState, glove: Point) => {
      const spec = PUNCHES[arm.kind!];
      const now = performance.now();
      const big = arm.kind === "upper" || arm.power > 0.78;
      bag.velocity += (0.07 + arm.power * 0.16) * spec.push * (arm.idle ? 0.5 : 1);
      bag.squash = Math.min(1, 0.45 + arm.power);
      const gx = DEVIL_X + glove.x + 20;
      const gy = FLOOR_Y + glove.y;
      dentRef.current?.setAttribute("cy", gy.toFixed(1));
      dentRef.current?.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: 380, easing: "ease-out" });
      if (arm.idle) return;

      hits += 1;
      combo = now - lastHit < 900 ? combo + 1 : 1;
      lastHit = now;
      if (hitsRef.current) {
        hitsRef.current.textContent = String(hits).padStart(3, "0");
        hitsRef.current.animate([{ transform: "scale(1.45) rotate(-4deg)", color: "#fff6d8" }, { transform: "scale(1)" }], { duration: 260, easing: "cubic-bezier(.2,1.6,.4,1)" });
      }
      if (comboRef.current && combo >= 3) {
        comboRef.current.textContent = `${combo}× COMBO`;
        comboRef.current.animate([
          { opacity: 0, transform: "translateX(-14px) skewX(-12deg) scale(1.3)" },
          { opacity: 1, transform: "translateX(0) skewX(-12deg) scale(1)", offset: 0.15 },
          { opacity: 1, transform: "translateX(0) skewX(-12deg) scale(1)", offset: 0.75 },
          { opacity: 0, transform: "translateX(6px) skewX(-12deg) scale(.96)" },
        ], { duration: 900, easing: "ease-out" });
      }

      // Comic burst at the point of contact.
      const words = big ? POW_WORDS.big : POW_WORDS.small;
      wordIndex = (wordIndex + 1) % words.length;
      if (powTextRef.current) powTextRef.current.textContent = words[wordIndex];
      const jitter = ((hits * 47) % 24) - 12;
      powRef.current?.setAttribute("transform", `translate(${(gx + 6).toFixed(1)} ${(gy - 22 + jitter).toFixed(1)}) rotate(${(hits % 2 ? -9 : 7)})`);
      const scale = big ? 1.12 : 0.62 + arm.power * 0.35;
      powInnerRef.current?.animate(reduced
        ? [{ opacity: 1, transform: `scale(${scale})` }, { opacity: 0, transform: `scale(${scale})` }]
        : [
          { opacity: 1, transform: `scale(${scale * 0.3}) rotate(-25deg)` },
          { opacity: 1, transform: `scale(${scale * 1.15}) rotate(3deg)`, offset: 0.22 },
          { opacity: 1, transform: `scale(${scale}) rotate(0deg)`, offset: 0.55 },
          { opacity: 0, transform: `scale(${scale * 1.08}) rotate(2deg)` },
        ], { duration: big ? 620 : 440, easing: "ease-out" });

      if (!reduced) {
        const s = (big ? 7 : 3) * (0.6 + arm.power);
        rootRef.current?.animate([
          { transform: "translate(0,0)" },
          { transform: `translate(${-s}px,${s * 0.5}px) rotate(${big ? -0.8 : -0.3}deg)` },
          { transform: `translate(${s * 0.7}px,${-s * 0.6}px)` },
          { transform: `translate(${-s * 0.3}px,${s * 0.2}px)` },
          { transform: "translate(0,0)" },
        ], { duration: big ? 300 : 190, easing: "ease-out" });
      }
      impactBus.forEach((listener) => listener({ power: arm.power, big }));
    };

    const unsubscribe = subscribeLevel((level) => {
      const { phase: ph, muted: mute } = live.current;
      const now = performance.now();
      const rising = level >= prevLevel;
      prevLevel = level;
      if (mute || (ph !== "hearing" && ph !== "listening")) return;
      if (level < 0.35 || now - lastPunch < 170) return;
      if (!rising && now - lastPunch < 320) return;
      const power = Math.min(1, (level - 0.3) / 0.6);
      if (level > 0.75) {
        if (!throwPunch("upper", power)) throwPunch("cross", power);
      } else {
        const kind: PunchKind = nextLead === "lead" ? "jab" : "cross";
        if (throwPunch(kind, power)) nextLead = nextLead === "lead" ? "rear" : "lead";
      }
      nextIdle = now + 1800;
    });

    const set = (el: Element | null, name: string, value: string) => el?.setAttribute(name, value);

    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const { phase: ph, tone: tn, muted: mute } = live.current;
      const pose = poseOf(ph);

      // Autonomous life: an occasional jab while listening, shadow-boxing while the call rings.
      if (!mute && ph === "listening" && now > nextIdle) {
        throwPunch(Math.random() < 0.7 ? "jab" : "cross", 0.25, { idle: true });
        nextIdle = now + 1500 + Math.random() * 1000;
      } else if (!mute && pose === "warm" && now > nextIdle) {
        throwPunch(nextLead === "lead" ? "jab" : "cross", 0.3, { air: true });
        nextLead = nextLead === "lead" ? "rear" : "lead";
        nextIdle = now + 650 + Math.random() * 450;
      }
      if (pose === "speak" || pose === "think" || mute) {
        arms.lead.kind = null;
        arms.rear.kind = null;
      }

      // Body rhythm.
      const tempo = tn === "heavy" ? 0.75 : tn === "fired_up" ? 1.25 : 1;
      let dy = 0;
      let breathe = 0;
      let hop = 0;
      if (pose === "fight") { hop = Math.abs(Math.sin(t * Math.PI * (ph === "hearing" ? 2.5 : 2) * tempo)) * 6; dy = -hop; }
      else if (pose === "warm") { hop = Math.abs(Math.sin(t * Math.PI * 1.5)) * 5; dy = -hop; }
      else if (pose === "speak") dy = Math.sin(t * Math.PI * 2.4) * 2;
      else { breathe = Math.sin(t * Math.PI * 1.5); dy = breathe * 1.5; }
      if (mute) { dy *= 0.25; hop *= 0.25; }

      // Arms.
      const guard = GUARD[pose === "warm" ? "fight" : pose];
      let leanTarget = pose === "think" ? 6 + breathe * 3 : pose === "speak" ? -3 : 0;
      let push = 0;
      (["lead", "rear"] as ArmKey[]).forEach((key) => {
        const arm = arms[key];
        const home = guard[key];
        let target = home;
        let spin = 0;
        let streak = 0;
        if (arm.kind) {
          const spec = PUNCHES[arm.kind];
          const p = (now - arm.t0) / arm.dur;
          if (p >= 1) { arm.kind = null; }
          else {
            const e = extension(p);
            // Track the bag's surface so a landed punch always connects, even mid-swing.
            const follow = Math.max(-12, Math.min(34, Math.sin(bag.angle) * (FLOOR_Y + spec.target.y - BAG_PIVOT_Y)));
            const reach = arm.air ? { x: home.x + (spec.target.x - home.x) * 0.7, y: spec.target.y + 6 } : { x: spec.target.x + follow, y: spec.target.y };
            if (e < 0) target = { x: home.x + spec.windup.x * -e, y: home.y + spec.windup.y * -e };
            else {
              const from = { x: home.x + spec.windup.x * (1 - Math.min(1, e * 1.4)), y: home.y + spec.windup.y * (1 - Math.min(1, e * 1.4)) };
              target = { x: from.x + (reach.x - from.x) * e, y: from.y + (reach.y - from.y) * e };
              if (arm.kind === "upper") target.y += Math.sin(e * Math.PI) * 14;
            }
            spin = spec.spin * Math.max(0, e);
            leanTarget = Math.max(leanTarget, spec.lean * Math.max(0, e));
            push = Math.max(push, 7 * Math.max(0, e));
            streak = p > 0.18 && p < 0.5 ? 0.9 : 0;
            if (!arm.landed && p >= 0.42) {
              arm.landed = true;
              if (!arm.air) land(arm, target);
            }
          }
        }
        const g = gloves[key];
        if (arm.kind) { g.x = target.x; g.y = target.y; }
        else { const k = 1 - Math.exp(-dt * 16); g.x += (target.x - g.x) * k; g.y += (target.y - g.y) * k; }
        const bob = pose === "fight" || pose === "warm" ? Math.sin(t * 6 + (key === "lead" ? 0 : 1.7)) * 2.2 : pose === "think" ? breathe * 3 : 0;
        const glove = { x: g.x, y: g.y + bob };
        const shoulder = rotateAround(SHOULDER[key], HIP, lean);
        shoulder.y += pose === "think" ? breathe * -3 : 0;
        const path = armPath(shoulder, glove, arm.kind ? 0.35 : 1);
        const armEl = key === "lead" ? leadArmEl : rearArmEl;
        armEl?.querySelectorAll("path").forEach((el) => el.setAttribute("d", path));
        const mirror = glove.x < shoulder.x - 6;
        set(key === "lead" ? leadGloveEl : rearGloveEl, "transform", gloveTransform(shoulder, glove, spin, mirror));
        const streakEl = key === "lead" ? leadStreakEl : rearStreakEl;
        set(streakEl, "transform", `translate(${glove.x.toFixed(1)} ${glove.y.toFixed(1)})`);
        set(streakEl?.firstElementChild ?? null, "opacity", reduced ? "0" : String(streak));
      });

      lean += (leanTarget - lean) * (1 - Math.exp(-dt * 18));
      set(devilRef.current, "transform", `translate(${(DEVIL_X + push).toFixed(1)} ${(FLOOR_Y + dy).toFixed(1)})`);
      set(upperEl, "transform", `rotate(${lean.toFixed(2)} ${HIP.x} ${HIP.y}) translate(0 ${pose === "think" ? (breathe * -2.5).toFixed(2) : 0})`);
      set(headEl, "transform", `rotate(${(pose === "speak" ? Math.sin(t * 2.6) * 4 : lean * 0.5 + (pose === "think" ? 6 : 0)).toFixed(2)})`);
      set(tailEl, "transform", `rotate(${(Math.sin(t * (pose === "think" ? 2 : 4.2) * tempo) * (mute ? 3 : 9) - lean * 0.8).toFixed(2)})`);
      set(browsEl, "transform", `translate(0 ${(push * 0.35).toFixed(2)})`);
      set(shadowRef.current, "rx", (64 - hop * 2).toFixed(1));
      set(shadowRef.current, "cx", push.toFixed(1));

      // Heavy bag: damped pendulum with a squash on contact.
      bag.velocity += (-9 * Math.sin(bag.angle) - 1.1 * bag.velocity) * dt;
      bag.angle += bag.velocity * dt;
      if (Math.abs(bag.angle) > 0.13) { bag.angle = Math.sign(bag.angle) * 0.13; bag.velocity *= -0.3; }
      bag.squash *= Math.exp(-dt * 11);
      const deg = (-bag.angle * 180) / Math.PI;
      set(bagRef.current, "transform", `rotate(${deg.toFixed(2)} ${BAG_X} ${BAG_PIVOT_Y})`);
      const sq = bag.squash;
      set(bagBodyRef.current, "transform", `translate(${BAG_X} 222) scale(${(1 - 0.12 * sq).toFixed(3)} ${(1 + 0.04 * sq).toFixed(3)}) skewY(${(sq * -4).toFixed(2)}) translate(${-BAG_X} -222)`);
      set(bagShadowRef.current, "cx", (BAG_X + Math.sin(bag.angle) * (FLOOR_Y - BAG_PIVOT_Y)).toFixed(1));
    };
    frame = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(frame); unsubscribe(); };
  }, [subscribeLevel]);

  const pose = poseOf(phase);
  return <div ref={rootRef} className={`${styles.stage} ${fonts} ${styles[`pose_${pose}`]} ${muted ? styles.isMuted : ""}`} data-tone={tone ?? "none"}>
    <div className={styles.hud}>
      <div className={styles.hits}><small>HITS</small><span ref={hitsRef}>000</span></div>
      <div className={styles.rage}><small>RAGE</small><i><b /></i></div>
      <div ref={comboRef} className={styles.combo} />
    </div>
    <svg className={styles.ring} viewBox="0 0 400 400" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <defs>
        <DevilDefs id={uid} />
        <linearGradient id={`${uid}-leather`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#240304" />
          <stop offset="0.22" stopColor="#6e100e" />
          <stop offset="0.4" stopColor="#b8261a" />
          <stop offset="0.52" stopColor="#d23a26" />
          <stop offset="0.7" stopColor="#7e130e" />
          <stop offset="1" stopColor="#1c0203" />
        </linearGradient>
        <linearGradient id={`${uid}-chain`} gradientUnits="userSpaceOnUse" x1="0" y1={BAG_PIVOT_Y} x2="0" y2="100">
          <stop offset="0.3" stopColor="#c9b8a6" stopOpacity="0" />
          <stop offset="0.62" stopColor="#c9b8a6" stopOpacity="0.85" />
          <stop offset="1" stopColor="#efe2d0" />
        </linearGradient>
        <radialGradient id={`${uid}-pool`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff6a2a" stopOpacity="0.45" />
          <stop offset="0.6" stopColor="#ff3a12" stopOpacity="0.12" />
          <stop offset="1" stopColor="#ff3a12" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-pow`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff7c2" />
          <stop offset="0.45" stopColor="#ffd23f" />
          <stop offset="1" stopColor="#ff7a1a" />
        </linearGradient>
      </defs>

      {/* Ring floor */}
      <ellipse cx="200" cy={FLOOR_Y + 2} rx="230" ry="34" fill={`url(#${uid}-pool)`} />
      <path d={`M-40 ${FLOOR_Y + 6} L440 ${FLOOR_Y + 6}`} stroke="#ff4a24" strokeOpacity="0.35" strokeWidth="1.5" />
      <ellipse ref={bagShadowRef} cx={BAG_X} cy={FLOOR_Y + 3} rx="46" ry="7" fill="#000" opacity="0.5" />

      {/* Heavy bag */}
      <g ref={bagRef}>
        <g fill="none" stroke={`url(#${uid}-chain)`} strokeWidth="3.2">
          {Array.from({ length: 17 }, (_, i) => {
            const y = BAG_PIVOT_Y + i * 14.5;
            return i % 2 === 0
              ? <ellipse key={i} cx={BAG_X} cy={y + 7} rx="4.5" ry="8.5" />
              : <path key={i} d={`M${BAG_X} ${y} L${BAG_X} ${y + 14}`} strokeWidth="5" />;
          })}
        </g>
        <circle cx={BAG_X} cy="103" r="7" fill="none" stroke="#efe2d0" strokeWidth="3.5" />
        <g stroke="#1a0606" strokeWidth="3" strokeLinecap="round">
          <path d={`M${BAG_X} 108 L${BAG_X - 36} 132`} /><path d={`M${BAG_X} 108 L${BAG_X - 13} 130`} />
          <path d={`M${BAG_X} 108 L${BAG_X + 13} 130`} /><path d={`M${BAG_X} 108 L${BAG_X + 36} 132`} />
        </g>
        <g ref={bagBodyRef}>
          <rect x={BAG_LEFT} y="126" width="84" height="196" rx="24" fill={`url(#${uid}-leather)`} stroke="#120202" strokeWidth="4" />
          <ellipse cx={BAG_X} cy="131" rx="38" ry="6" fill="#2a0404" opacity="0.8" />
          <rect x={BAG_LEFT + 2} y="150" width="80" height="13" fill="#140202" opacity="0.55" />
          <rect x={BAG_LEFT + 2} y="290" width="80" height="13" fill="#140202" opacity="0.55" />
          <g stroke="#f4dcc0" strokeOpacity="0.55" strokeWidth="1.3" strokeDasharray="4 3">
            <path d={`M${BAG_LEFT + 4} 148 L${BAG_LEFT + 80} 148`} /><path d={`M${BAG_LEFT + 4} 165 L${BAG_LEFT + 80} 165`} />
            <path d={`M${BAG_LEFT + 4} 288 L${BAG_LEFT + 80} 288`} /><path d={`M${BAG_LEFT + 4} 305 L${BAG_LEFT + 80} 305`} />
          </g>
          <rect x={BAG_X - 22} y="138" width="9" height="174" rx="4.5" fill="#fff" opacity="0.13" />
          <g transform={`rotate(-5 ${BAG_X} 228)`}>
            <rect x={BAG_X - 29} y="194" width="58" height="66" rx="6" fill="#f6e4c6" stroke="#120202" strokeWidth="3" />
            <rect x={BAG_X - 25} y="198" width="50" height="58" rx="4" fill="none" stroke="#c3150b" strokeWidth="1.5" />
            <text x={BAG_X} y="226" textAnchor="middle" className={styles.bagText}>HIT</text>
            <text x={BAG_X} y="253" textAnchor="middle" className={styles.bagText}>ME</text>
          </g>
          <ellipse ref={dentRef} cx={BAG_LEFT + 6} cy="210" rx="8" ry="20" fill="#000" opacity="0" />
        </g>
      </g>

      {/* Fire aura when fired up */}
      <ellipse className={styles.aura} cx={DEVIL_X + 8} cy={FLOOR_Y - 170} rx="120" ry="150" />

      {/* Devil */}
      <ellipse ref={shadowRef} cx="0" cy="0" rx="64" ry="9" fill="#000" opacity="0.55" transform={`translate(${DEVIL_X} ${FLOOR_Y + 2})`} />
      <g ref={devilRef} transform={`translate(${DEVIL_X} ${FLOOR_Y})`}>
        <Devil id={uid} pose={pose === "speak" ? "speak" : pose === "think" ? "think" : "fight"} />
      </g>

      {/* Comic impact */}
      <g ref={powRef}>
        <g ref={powInnerRef} className={styles.pow}>
          <g stroke="#fff3c9" strokeWidth="3" strokeLinecap="round">
            <path d="M-96 -6 L-120 -10" /><path d="M-90 26 L-112 40" /><path d="M-84 -40 L-104 -58" />
            <path d="M88 -44 L108 -60" /><path d="M96 10 L122 14" /><path d="M84 40 L104 56" />
          </g>
          <polygon points={BURST} fill="#1d0604" transform="translate(5 6)" />
          <polygon points={BURST} fill={`url(#${uid}-pow)`} stroke="#1d0604" strokeWidth="4" strokeLinejoin="round" />
          <text ref={powTextRef} className={styles.powText} textAnchor="middle" y="13">POW!</text>
        </g>
      </g>
    </svg>
  </div>;
}

/* ───────────── Cover art ───────────── */

function PunchCover() {
  const uid = useUid();
  return <svg className={`${styles.cover} ${fonts}`} viewBox="-183 -342 390 390" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs><DevilDefs id={uid} /></defs>
    <ellipse cx="6" cy="2" rx="66" ry="9" fill="#000" opacity="0.45" />
    <g className={styles.coverBounce}><Devil id={uid} /></g>
  </svg>;
}

export const punch: SceneModule = {
  Backdrop: PunchBackdrop,
  Stage: PunchStage,
  theme: `${styles.theme} ${fonts}`,
  CoverArt: PunchCover,
  cover: { background: "#1b0f0e", ink: "#fff4ec" },
  kicker: "DEVIL MODE",
};
