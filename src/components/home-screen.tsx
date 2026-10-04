"use client";

import Image from "next/image";
import { Icon } from "./icon";
import { sceneOptions, scenes, type VentScene } from "./scenes";
import { monthShort } from "@/lib/mood";
import type { CallMode, JournalEntry } from "@/lib/types";

function todayLine() {
  return new Date().toLocaleDateString("en-IN", { weekday: "short", month: "long", day: "numeric" }).replace(",", " ·").toUpperCase();
}

export function HomeScreen({ entries, scene, chooseScene, startCall, openEntry }: { entries: JournalEntry[]; scene: VentScene; chooseScene: (scene: VentScene) => void; startCall: (mode: CallMode) => void; openEntry: (entry: JournalEntry) => void }) {
  const latest = entries[0];
  const option = sceneOptions.find((item) => item.id === scene) ?? sceneOptions[0];
  const { CoverArt, cover } = scenes[scene];
  return <main className="screen home-screen">
    <section className="editorial-cover">
      <div className="issue-line"><span>TODAY</span><span suppressHydrationWarning>{todayLine()}</span></div>
      <h1 className="cover-title">How are<br />you, <em>really?</em></h1>
      <div className={`cover-call cover-${scene}`} style={{ background: cover.background, color: cover.ink }}>
        <button className="cover-hit" onClick={() => startCall("vent")} aria-label={`Call VENT: ${option.cover}`} />
        <div className="scene-switch" role="radiogroup" aria-label="How do you want to let it out?">
          {sceneOptions.map((item) => <button key={item.id} role="radio" aria-checked={scene === item.id} className={scene === item.id ? "selected" : ""} onClick={() => chooseScene(item.id)}>{item.label}</button>)}
        </div>
        <span className="cover-shape-a" aria-hidden="true" /><span className="cover-shape-b" aria-hidden="true" />
        <span className="cover-mascot" key={scene}>
          {scene === "breathe"
            ? <><span className="cover-sun" /><Image src="/vent-listener.png" alt="" width={300} height={300} priority /></>
            : <span className="cover-art"><CoverArt /></span>}
        </span>
        <span className="cover-call-copy"><small>CALL VENT</small><strong>{option.cover}</strong></span>
        <span className="cover-phone"><Icon name="phone" /></span>
      </div>
    </section>
    <section className="editorial-actions">
      <button className="journal-feature" onClick={() => startCall("journal")} aria-label="Call to make today's journal page">
        <span className="feature-lines" aria-hidden="true"><i /><i /><i /></span>
        <span className="feature-copy"><small>CAPTURE TODAY</small><strong>Make a<br />journal page</strong></span>
        <span className="feature-phone"><Icon name="phone" /></span>
      </button>
      {latest
        ? <button className="day-feature" onClick={() => openEntry(latest)}>
          <span className="day-blob" style={{ background: latest.mood.color }} aria-hidden="true" />
          <span className="day-date">{latest.date.slice(-2)}<i>{monthShort(latest.date)}</i></span>
          <span className="day-copy"><small>LATEST PAGE · {latest.mood.label.toUpperCase()}</small><strong>{latest.title}</strong></span>
        </button>
        : <button className="day-feature" onClick={() => startCall("journal")}>
          <span className="day-blob" aria-hidden="true" />
          <span className="day-copy"><small>YOUR FIRST</small><strong>Page one<br />starts here</strong></span>
        </button>}
    </section>
    <div className="privacy-note"><Icon name="shield" /><span>Private by default</span></div>
  </main>;
}
