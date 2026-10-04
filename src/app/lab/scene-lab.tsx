"use client";

import { useCallback, useEffect, useRef } from "react";
import { Icon } from "@/components/icon";
import { scenes, type CallPhase, type SceneProps, type VentScene } from "@/components/scenes";
import type { ListenerTone } from "@/lib/types";

/** Renders a call screen with simulated mic/voice levels so scenes can be crafted without a real call. */
export function SceneLab({ scene = "breathe", phase = "listening", tone }: { scene?: string; phase?: string; tone?: string }) {
  const id = (["breathe", "punch"].includes(scene) ? scene : "breathe") as VentScene;
  const active = scenes[id];
  const hostRef = useRef<HTMLDivElement>(null);
  const listeners = useRef(new Set<(level: number) => void>());
  const subscribeLevel = useCallback((listener: (level: number) => void) => {
    listeners.current.add(listener);
    return () => { listeners.current.delete(listener); };
  }, []);

  useEffect(() => {
    // Fake speech: syllable bursts while "hearing", VENT's voice while "speaking".
    let t = 0;
    const timer = window.setInterval(() => {
      t += 1;
      const burst = Math.max(0, Math.sin(t / 2.3)) * (0.45 + 0.55 * Math.abs(Math.sin(t / 0.9)));
      const level = phase === "hearing" ? burst : 0;
      const voice = phase === "speaking" ? burst : 0;
      hostRef.current?.style.setProperty("--level", level.toFixed(3));
      hostRef.current?.style.setProperty("--voice", voice.toFixed(3));
      listeners.current.forEach((listener) => listener(level));
    }, 43);
    return () => window.clearInterval(timer);
  }, [phase]);

  const props: SceneProps = { phase: phase as CallPhase, tone: (tone as ListenerTone) ?? null, muted: false, subscribeLevel };

  return <div className="app-shell screen-call">
    <main className={`call-screen call-vent phase-${phase} vent-scene vent-scene-${id} ${active.theme}`} data-tone={tone}>
      <div className="scene-backdrop" aria-hidden="true"><active.Backdrop {...props} /></div>
      <header className="call-identity">
        <span className="call-kicker">{active.kicker}</span>
        <h1>Vent</h1>
        <div className="call-state">{phase === "ringing" ? "ringing…" : "01:24"}</div>
      </header>
      <div className="call-body">
        <div className="scene-host" ref={hostRef}><active.Stage {...props} /></div>
      </div>
      <div className="ios-controls">
        <button className="call-control"><span><Icon name="mic" /></span>mute</button>
        <button className="call-control" disabled><span><Icon name="keypad" /></span>keypad</button>
        <button className="call-control"><span><Icon name="audio" /></span>audio</button>
        <button className="call-control" disabled><span><Icon name="plus" /></span>add call</button>
        <button className="call-control" disabled><span><Icon name="video" /></span>FaceTime</button>
        <button className="call-control" disabled><span><Icon name="person" /></span>contacts</button>
      </div>
      <button className="end-call" aria-label="End call"><Icon name="phone" /></button>
    </main>
    <div style={{ position: "fixed", left: 12, bottom: 12, zIndex: 50, width: 120, height: 120, background: "#fff", borderRadius: 16, display: "grid", placeItems: "center" }}>
      <div style={{ width: 110, height: 110 }}><active.CoverArt /></div>
    </div>
  </div>;
}
