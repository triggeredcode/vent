"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CallPhase, SceneProps } from "../types";
import { Figure } from "./figure";
import { frame, hang, HANG_CY, mix, stand, TOP_CY, type Pose } from "./rig";
import styles from "../sweat.module.css";

type Mode = "warm" | "pull" | "rest" | "flex" | "pause" | "slump";

export function modeOf(phase: CallPhase, muted: boolean): Mode {
  if (phase === "connecting" || phase === "ringing") return "warm";
  if (phase === "error") return "slump";
  if (muted) return "pause";
  if (phase === "thinking") return "rest";
  if (phase === "speaking") return "flex";
  return "pull";
}

const coach: Record<Mode, string> = {
  warm: "Warm up",
  pull: "Steady reps",
  rest: "Catch your breath",
  flex: "Coach talk",
  pause: "Paused",
  slump: "Shake it off",
};

const DROPS = 16;
const SET = 10;
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;
const sid = (raw: string) => raw.replace(/[^a-zA-Z0-9]/g, "");

/** One rep: explode up, hold and shake at the top, lower under control. Returns 0 (hang) … 1 (chin over bar). */
function liftAt(u: number) {
  if (u < 0.4) return easeInOutCubic(u / 0.4);
  if (u < 0.52) return 1;
  return 1 - easeInOutSine((u - 0.52) / 0.48);
}

interface Drop { x: number; y: number; vx: number; vy: number; life: number; size: number }

export function SweatStage({ phase, tone, muted, subscribeLevel }: SceneProps) {
  const uid = sid(useId());
  const rootRef = useRef<HTMLDivElement>(null);
  const repsRef = useRef<HTMLSpanElement>(null);
  const plusRef = useRef<HTMLSpanElement>(null);
  const setRef = useRef<HTMLElement>(null);
  const ringRef = useRef<SVGGElement>(null);
  const modeRef = useRef<Mode>(modeOf(phase, muted));
  const phaseRef = useRef(phase);
  const levelRef = useRef(0);
  const mode = modeOf(phase, muted);
  const [firstPose] = useState(() => (mode === "pull" || mode === "pause" ? hang() : stand()));

  useEffect(() => { modeRef.current = mode; phaseRef.current = phase; }, [mode, phase]);
  useEffect(() => subscribeLevel((level) => { levelRef.current = level; }), [subscribeLevel]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const parts = new Map<string, Element[]>();
    root.querySelectorAll("[data-k]").forEach((el) => {
      const key = el.getAttribute("data-k")!;
      parts.set(key, [...(parts.get(key) ?? []), el]);
    });
    const dropEls = [...root.querySelectorAll<SVGPathElement>("[data-drop]")];
    const segments = [...(ringRef.current?.querySelectorAll("[data-seg]") ?? [])];
    const host = root.parentElement;

    let pose: Pose = modeRef.current === "pull" || modeRef.current === "pause" ? hang() : stand();
    let last = performance.now();
    let time = 0;
    let cycle = 0.55;
    let prevU = cycle;
    let prevLift = 0;
    let level = 0;
    let voice = 0;
    let reps = 0;
    let sets = 1;
    let wipeBeat = 0;
    let raf = 0;
    const drops: Drop[] = [];

    const emit = (x: number, y: number, dir: number, power: number) => {
      if (reduce || drops.length >= DROPS) return;
      drops.push({ x, y, vx: dir * (50 + Math.random() * 110) * (0.7 + power * 0.6), vy: -(70 + Math.random() * 120) * (0.7 + power * 0.5), life: 1, size: 0.65 + Math.random() * 0.5 });
    };

    const pop = (el: Element | null, keyframes: Keyframe[], duration: number) => {
      if (!el || reduce) return;
      el.animate(keyframes, { duration, easing: "cubic-bezier(.2,.9,.3,1.2)" });
    };

    const countRep = (power: number) => {
      reps += 1;
      if (repsRef.current) repsRef.current.textContent = String(reps).padStart(3, "0");
      const inSet = reps % SET;
      segments.forEach((seg, index) => seg.toggleAttribute("data-on", inSet === 0 ? true : index < inSet));
      pop(plusRef.current, [
        { opacity: 0, transform: "translate(-4px, 10px) scale(.4) rotate(-14deg)" },
        { opacity: 1, transform: "translate(0, -6px) scale(1.25) rotate(-8deg)", offset: 0.25 },
        { opacity: 1, transform: "translate(4px, -18px) scale(1) rotate(-8deg)", offset: 0.7 },
        { opacity: 0, transform: "translate(8px, -34px) scale(.9) rotate(-8deg)" },
      ], 900);
      pop(repsRef.current, [{ transform: "scale(1.16) skewX(-6deg)", color: "var(--sw-hot)" }, { transform: "scale(1)" }], 380);
      if (inSet === 0) {
        sets += 1;
        pop(ringRef.current, [{ transform: "rotate(0) scale(1.18)" }, { transform: "rotate(36deg) scale(1)" }], 700);
        window.setTimeout(() => {
          if (setRef.current) setRef.current.textContent = String(sets).padStart(2, "0");
          segments.forEach((seg) => seg.removeAttribute("data-on"));
        }, 650);
      }
      const count = 1 + Math.round(power * 4);
      for (let index = 0; index < count; index += 1) emit(pose.cx + (index % 2 ? 46 : -46), pose.cy - 34, index % 2 ? 1 : -1, power);
    };

    const target = (m: Mode, dt: number): Pose => {
      const t = reduce ? 0 : time;
      if (m === "pull") {
        const hearing = phaseRef.current === "hearing";
        const intensity = hearing ? clamp(level * 1.5) : 0;
        const period = hearing ? 0.95 - intensity * 0.3 : 1.8;
        cycle += dt / period;
        const u = cycle % 1;
        if (prevU < 0.4 && u >= 0.4) countRep(hearing ? 0.35 + intensity * 0.65 : 0.15);
        prevU = u;
        const lift = reduce ? 0.55 : liftAt(u);
        const vel = dt > 0 ? (lift - prevLift) / dt : 0;
        prevLift = lift;
        const strain = smooth(0.82, 0.97, lift);
        const shake = strain * (0.6 + intensity * 1.6);
        const p = hang(HANG_CY + (TOP_CY - HANG_CY) * lift, 160 + Math.sin(t * 70) * shake);
        const swing = Math.sin(cycle * Math.PI * 2 + 0.9) * (6 + intensity * 8);
        const tuck = Math.pow(lift, 1.4);
        const hipY = p.cy + 50;
        p.lfx = p.cx - 30 + swing + tuck * -8; p.lfy = hipY + 54 - tuck * 22;
        p.rfx = p.cx + 30 + swing + tuck * 8; p.rfy = hipY + 54 - tuck * 22;
        p.tilt = swing * 0.25;
        p.toe = 0.85 - tuck * 0.35;
        p.squint = strain; p.grit = strain;
        p.puff = strain * (0.4 + intensity * 0.6);
        p.effort = strain * (0.35 + intensity * 0.65);
        p.brow = 0.8 + strain * 0.3;
        p.lookY = -0.8;
        p.sx = 1 + strain * 0.035; p.sy = 1 - strain * 0.03;
        p.tails = clamp(-vel * 9, -25, 30) + Math.sin(t * 12) * 5;
        p.shadow = 0.25 * (1 - lift) + 0.1;
        if (!reduce && strain > 0.9 && intensity > 0.45 && Math.random() < dt * 6 * intensity) emit(p.cx + (Math.random() < 0.5 ? -50 : 50), p.cy - 30, Math.random() < 0.5 ? -1 : 1, intensity);
        root.style.setProperty("--burn", (hearing ? 0.25 + intensity * 0.75 : 0.18 + 0.12 * lift).toFixed(3));
        return p;
      }
      root.style.setProperty("--burn", m === "flex" ? (0.2 + voice * 0.8).toFixed(3) : m === "rest" ? "0.12" : "0.05");
      prevLift = 0;

      if (m === "warm") {
        const sway = Math.sin(t * Math.PI * 2 / 2.6);
        const p = stand();
        p.tilt = sway * 10;
        p.cx = 160 + sway * 4;
        p.lhx = p.cx - 14 + sway * 44; p.lhy = p.cy - 112;
        p.rhx = p.cx + 14 + sway * 44; p.rhy = p.cy - 112;
        p.lfx = p.cx - 40; p.rfx = p.cx + 40;
        p.happy = 1; p.smile = 1; p.brow = -0.25; p.browLift = 0.4;
        p.tails = sway * 18;
        return p;
      }
      if (m === "rest") {
        const breath = Math.sin(t * Math.PI * 2 / 1.1);
        const wipe = 0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 1.8);
        const beat = Math.floor(t / 1.8);
        if (beat !== wipeBeat) { wipeBeat = beat; emit(pose.cx - 52, pose.cy - 40, -1, 0.1); }
        const p = stand();
        p.cy += breath * -1.6;
        p.sx = 1 - breath * 0.015; p.sy = 1 + breath * 0.028;
        p.lhx = p.cx - 64; p.lhy = p.cy + 24;
        p.rhx = p.cx + 44 - wipe * 64; p.rhy = p.cy - 38 - Math.sin(wipe * Math.PI) * 3;
        p.eyeOpen = 0.5; p.lookX = 0.5; p.lookY = -0.9;
        p.open = 1; p.mouthOpen = 0.3 + 0.25 * (breath + 1) / 2;
        p.brow = -0.55; p.browLift = 0.3; p.puff = 0.2;
        p.tails = Math.sin(t * 3) * 6;
        return p;
      }
      if (m === "flex") {
        const pulse = 0.5 + 0.5 * Math.sin(t * 5);
        const p = stand();
        p.cy -= voice * 6;
        p.tilt = Math.sin(t * 2.2) * 3;
        p.lhx = p.cx - 64; p.lhy = p.cy - 70 - voice * 10;
        p.rhx = p.cx + 64; p.rhy = p.cy - 70 - voice * 10;
        p.lfx = p.cx - 44; p.rfx = p.cx + 44;
        p.flex = 0.55 + pulse * 0.2 + voice * 0.45;
        p.lookY = 0; p.brow = 0.25; p.browLift = 0.55;
        p.open = 1; p.mouthOpen = clamp(voice * 1.3);
        p.tails = Math.sin(t * 6) * 10;
        return p;
      }
      if (m === "pause") {
        const p = hang();
        p.eyeOpen = 0.1; p.brow = 0; p.lookY = 0; p.toe = 0.9;
        return p;
      }
      const p = hang(HANG_CY + 6);
      p.tilt = 6; p.lookY = 0.7; p.brow = -0.8; p.toe = 1;
      return p;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;
      level += (levelRef.current - level) * Math.min(1, dt * 7);
      const rawVoice = host ? parseFloat(host.style.getPropertyValue("--voice")) || 0 : 0;
      voice += (rawVoice - voice) * Math.min(1, dt * 18);

      const m = modeRef.current;
      const next = target(m, dt);
      pose = reduce ? next : mix(pose, next, 1 - Math.exp(-dt * (m === "pull" ? 22 : 9)));
      const f = frame(pose);
      for (const [key, attrs] of Object.entries(f)) {
        const els = parts.get(key);
        if (!els) continue;
        for (const el of els) for (const name in attrs) el.setAttribute(name, String(attrs[name]));
      }

      for (let index = drops.length - 1; index >= 0; index -= 1) {
        const drop = drops[index];
        drop.vy += 620 * dt; drop.x += drop.vx * dt; drop.y += drop.vy * dt; drop.life -= dt * 1.1;
        if (drop.life <= 0 || drop.y > 430) drops.splice(index, 1);
      }
      dropEls.forEach((el, index) => {
        const drop = drops[index];
        if (!drop) { el.setAttribute("opacity", "0"); return; }
        const angle = Math.atan2(drop.vy, drop.vx) * 180 / Math.PI - 90;
        el.setAttribute("transform", `translate(${drop.x.toFixed(1)} ${drop.y.toFixed(1)}) rotate(${angle.toFixed(0)}) scale(${drop.size.toFixed(2)})`);
        el.setAttribute("opacity", Math.min(1, drop.life * 2.5).toFixed(2));
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <div ref={rootRef} className={styles.stage} data-mode={mode} data-tone={tone ?? undefined} data-muted={muted || undefined}>
    <div className={styles.hud}>
      <div className={styles.reps}>
        <small>Reps</small>
        <span ref={repsRef} className={styles.repsNum}>000</span>
        <span ref={plusRef} className={styles.plus}>+1</span>
      </div>
      <div className={styles.coach}><span>{phase === "hearing" && !muted ? "Push it!" : coach[mode]}</span></div>
      <div className={styles.set}>
        <svg viewBox="-40 -40 80 80" aria-hidden="true">
          <g ref={ringRef} className={styles.ring}>
            {Array.from({ length: SET }, (_, index) => {
              const a0 = (index / SET) * Math.PI * 2 - Math.PI / 2 + 0.07;
              const a1 = ((index + 1) / SET) * Math.PI * 2 - Math.PI / 2 - 0.07;
              const p = (a: number) => `${(34 * Math.cos(a)).toFixed(2)} ${(34 * Math.sin(a)).toFixed(2)}`;
              return <path key={index} data-seg="" d={`M${p(a0)} A34 34 0 0 1 ${p(a1)}`} />;
            })}
          </g>
        </svg>
        <span className={styles.setLabel}><small>Set</small><strong ref={setRef}>01</strong></span>
      </div>
    </div>

    <div className={styles.burn} aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => <i key={index} style={{ "--i": 7 - index } as React.CSSProperties} />)}
      <small>Burn</small>
    </div>

    <Figure className={styles.figure} pose={firstPose} uid={uid} drops={DROPS} viewBox="0 0 320 420" align="xMidYMax meet" />
  </div>;
}
