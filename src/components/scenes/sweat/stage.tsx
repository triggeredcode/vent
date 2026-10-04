"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { CallPhase, SceneProps } from "../types";
import type { BotMode, Drive, GymBot } from "./gym-bot";
import { createSfx } from "./sfx";
import styles from "../sweat.module.css";

export const COVER_SRC = "/models/gym-bot-cover.png";

const SET = 10;
/** Height of the LED board strip on top of the track (sweat.module.css .board). */
const BOARD = 22;
/** Mic level that counts as "the caller is talking". A touch higher before VAD has confirmed speech. */
const GATE_HEARING = 0.12;
const GATE_LISTENING = 0.18;
/** Keep the gate open this long after the level drops, so syllable gaps don't stutter the workout. */
const HOLD_MS = 250;
/** Jumping-jack tempo in reps per second: quiet talk → loud talk. Capped so it never looks frantic. */
const TEMPO_MIN = 0.85;
const TEMPO_MAX = 1.65;
/** When the caller stops mid-rep, the bot finishes it at this tempo, then stands at ready. */
const TEMPO_FINISH = 1.4;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const damp = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));

export function modeOf(phase: CallPhase, muted: boolean): BotMode {
  if (phase === "connecting" || phase === "ringing") return "warm";
  if (phase === "error") return "slump";
  if (muted) return "pause";
  if (phase === "thinking") return "rest";
  if (phase === "speaking") return "talk";
  return "work";
}

const coach: Record<BotMode, string> = {
  warm: "Warm up",
  work: "Talk to rep",
  talk: "Coach talk",
  rest: "Catch your breath",
  pause: "Paused",
  slump: "Shake it off",
};

export function SweatStage({ phase, tone, muted, subscribeLevel }: SceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLDivElement>(null);
  const repsRef = useRef<HTMLSpanElement>(null);
  const plusRef = useRef<HTMLSpanElement>(null);
  const setRef = useRef<HTMLElement>(null);
  const ringRef = useRef<SVGGElement>(null);
  const coachRef = useRef<HTMLSpanElement>(null);
  const mode = modeOf(phase, muted);
  const live = useRef({ mode, phase });
  const levelRef = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => { live.current = { mode, phase }; }, [mode, phase]);
  useEffect(() => subscribeLevel((level) => { levelRef.current = level; }), [subscribeLevel]);

  useEffect(() => {
    const root = rootRef.current;
    const figure = figureRef.current;
    if (!root || !figure) return;
    // A fresh canvas per mount: a disposed renderer force-loses its context, which a reused canvas would keep.
    const canvas = document.createElement("canvas");
    canvas.className = styles.canvas;
    figure.appendChild(canvas);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const host = root.parentElement;
    const segments = [...(ringRef.current?.querySelectorAll("[data-seg]") ?? [])];
    const sfx = createSfx();

    let bot: GymBot | null = null;
    let cancelled = false;
    let visible = true;
    let raf = 0;
    let last = performance.now();

    // Workout state.
    let level = 0;
    let voice = 0;
    let effort = 0;
    let rep = 0;
    let working = false; // a rep is in progress
    let earned = 0; // how much of the current rep happened while the caller was talking
    let holdUntil = 0;
    let lastActive = -Infinity;
    let reps = 0;
    let sets = 1;
    let shownActive: boolean | null = null;
    let shownCoach = "";

    const pop = (el: Element | null, keyframes: Keyframe[], duration: number) => {
      if (!el || reduce) return;
      el.animate(keyframes, { duration, easing: "cubic-bezier(.2,.9,.3,1.2)" });
    };

    const countRep = (power: number, audible: boolean) => {
      reps += 1;
      if (repsRef.current) repsRef.current.textContent = String(reps).padStart(3, "0");
      const inSet = reps % SET;
      const { mode: m, phase: p } = live.current;
      // Sounds only while the caller has the floor: never while VENT talks, rings, thinks, or when muted.
      if (audible && m === "work" && (p === "hearing" || p === "listening")) {
        sfx.rep(power);
        if (inSet === 0) sfx.setDone();
      }
      bot?.sweat(power);
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
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { mode: m, phase: p } = live.current;

      // Feedback guard: while our own sound may be leaking into the mic, only let the level fall.
      const raw = sfx.sounding() ? Math.min(levelRef.current, level) : levelRef.current;
      level = damp(level, raw, raw > level ? 18 : 8, dt);
      const rawVoice = host ? parseFloat(host.style.getPropertyValue("--voice")) || 0 : 0;
      voice = damp(voice, rawVoice, 18, dt);

      // The gate: the bot only works out while the caller is actually making sound.
      const canWork = m === "work";
      const threshold = p === "hearing" ? GATE_HEARING : GATE_LISTENING;
      if (canWork && level > threshold) holdUntil = now + HOLD_MS;
      const active = canWork && now < holdUntil;
      if (active) lastActive = now;
      const push = active ? clamp((level - threshold) / (0.62 - threshold)) : 0;
      effort = damp(effort, push, active ? 5 : 2.5, dt);

      // Reps only start while the gate is open. If the caller stops mid-rep the bot finishes that rep
      // (it counts only if nearly all of it was done while they were talking), then stands at ready.
      if (active || working) {
        working = true;
        const tempo = active ? TEMPO_MIN + (TEMPO_MAX - TEMPO_MIN) * effort : TEMPO_FINISH;
        const step = Math.min(1 - rep, dt * tempo * (reduce ? 0.6 : 1));
        rep += step;
        if (active) earned += step;
        if (rep >= 1 - 1e-6) {
          // Completed while talking (or nearly all of it was): count it. The exhale only plays if they still are.
          if (active || earned >= 0.85) countRep(0.3 + effort * 0.7, active);
          rep = 0;
          earned = 0;
          working = active;
        }
      }

      const sinceActive = (now - lastActive) / 1000;
      const shake = canWork && !working && sinceActive > 0.25 && sinceActive < 1.4 && reps > 0 ? Math.sin(((sinceActive - 0.25) / 1.15) * Math.PI) : 0;
      root.style.setProperty("--burn", (m === "work" ? 0.06 + effort * 0.94 : m === "talk" ? 0.15 + voice * 0.6 : m === "rest" ? 0.12 : 0.04).toFixed(3));

      if (shownActive !== active) {
        shownActive = active;
        root.toggleAttribute("data-active", active);
      }
      const label = active || (working && m === "work") ? "Push it!" : coach[m];
      if (label !== shownCoach && coachRef.current) {
        shownCoach = label;
        coachRef.current.textContent = label;
      }

      if (bot && visible) {
        const drive: Drive = { mode: m, rep, effort, shake: reduce ? 0 : shake, voice };
        bot.render(dt, drive);
      }
    };

    /** Stand the bot on the LED board: the track starts --sw-floor above the bottom of the call screen. */
    const plant = () => {
      const screen = root.closest("main") ?? document.body;
      const floor = parseFloat(getComputedStyle(root).getPropertyValue("--sw-floor")) || 364;
      const boardTop = screen.getBoundingClientRect().bottom - floor - BOARD;
      root.style.setProperty("--sw-feet", `${Math.round(root.getBoundingClientRect().bottom - boardTop)}px`);
    };
    const resize = () => {
      plant();
      const rect = canvas.getBoundingClientRect();
      bot?.resize(rect.width, rect.height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    observer.observe(root);
    const seen = new IntersectionObserver((entries) => { visible = entries.some((entry) => entry.isIntersecting); });
    seen.observe(canvas);
    const onVisibility = () => { last = performance.now(); };
    document.addEventListener("visibilitychange", onVisibility);

    import("./gym-bot")
      .then(({ createGymBot }) => createGymBot(canvas))
      .then((created) => {
        if (cancelled) { created.dispose(); return; }
        bot = created;
        resize();
        bot.render(0, { mode: live.current.mode, rep: 0, effort: 0, shake: 0, voice: 0 });
        setReady(true);
      })
      .catch((error) => { console.warn("[sweat] 3D buddy unavailable, keeping the poster", error); });

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      seen.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      sfx.dispose();
      bot?.dispose();
      bot = null;
      canvas.remove();
    };
  }, []);

  return <div ref={rootRef} className={styles.stage} data-mode={mode} data-tone={tone ?? undefined} data-muted={muted || undefined} data-ready={ready || undefined}>
    <div className={styles.hud}>
      <div className={styles.reps}>
        <small>Reps</small>
        <span ref={repsRef} className={styles.repsNum}>000</span>
        <span ref={plusRef} className={styles.plus}>+1</span>
      </div>
      <div className={styles.coach}><span ref={coachRef}>{coach[mode]}</span></div>
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

    <div ref={figureRef} className={styles.figure} aria-hidden="true">
      <Image className={styles.poster} src={COVER_SRC} alt="" width={600} height={600} unoptimized />
    </div>
  </div>;
}
