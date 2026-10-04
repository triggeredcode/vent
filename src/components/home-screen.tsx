"use client";

import Image from "next/image";
import { Icon } from "./icon";
import { inkFor, monthShort } from "@/lib/mood";
import type { CallMode, JournalEntry } from "@/lib/types";

function todayLine() {
  return new Date().toLocaleDateString("en-IN", { weekday: "short", month: "long", day: "numeric" }).replace(",", " ·").toUpperCase();
}

export function HomeScreen({ entries, startCall, openEntry }: { entries: JournalEntry[]; startCall: (mode: CallMode) => void; openEntry: (entry: JournalEntry) => void }) {
  const latest = entries[0];
  return <main className="screen home-screen">
    <section className="editorial-cover">
      <div className="issue-line"><span>TODAY</span><span suppressHydrationWarning>{todayLine()}</span></div>
      <h1>How are<br />you, <em>really?</em></h1>
      <button className="cover-call" onClick={() => startCall("vent")} aria-label="Call VENT">
        <span className="cover-mascot"><span className="cover-sun" /><Image src="/vent-listener.png" alt="" width={250} height={250} priority /></span>
        <span className="cover-call-copy"><small>CALL VENT</small><strong>Talk it out</strong></span>
        <span className="cover-phone"><Icon name="phone" /></span>
      </button>
    </section>
    <section className="editorial-actions">
      <button className="journal-feature" onClick={() => startCall("journal")}>
        <span className="feature-number">01</span>
        <span><small>CAPTURE TODAY</small><strong>Make a<br />journal page</strong></span>
        <Icon name="arrow" />
      </button>
      {latest
        ? <button className="day-feature" style={{ background: latest.mood.color, color: inkFor(latest.mood.color) }} onClick={() => openEntry(latest)}>
          <span className="day-color" />
          <span><small>LATEST</small><strong>{latest.title}</strong></span>
          <span className="day-date">{latest.date.slice(-2)}<br /><i>{monthShort(latest.date)}</i></span>
        </button>
        : <button className="day-feature" onClick={() => startCall("journal")}>
          <span className="day-color" />
          <span><small>YOUR FIRST</small><strong>Page one<br />starts here</strong></span>
        </button>}
    </section>
    <div className="privacy-note"><Icon name="shield" /><span>Private by default</span></div>
  </main>;
}
