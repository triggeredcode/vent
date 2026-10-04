"use client";

import Image from "next/image";
import { Icon } from "./icon";
import { localDate, monthShort } from "@/lib/mood";
import type { CallMode, JournalEntry } from "@/lib/types";

function todayLine() {
  return new Date().toLocaleDateString("en-IN", { weekday: "short", month: "long", day: "numeric" }).replace(",", " ·").toUpperCase();
}

/** The last seven days, oldest first, each with the day's latest page if there is one. */
function lastWeek(entries: JournalEntry[]) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - index));
    const date = localDate(day);
    return { date, letter: day.toLocaleDateString("en-IN", { weekday: "narrow" }), entry: entries.find((entry) => entry.date === date) };
  });
}

export function HomeScreen({ entries, startCall, openEntry, openJournal }: { entries: JournalEntry[]; startCall: (mode: CallMode) => void; openEntry: (entry: JournalEntry) => void; openJournal: () => void }) {
  const latest = entries[0];
  const week = lastWeek(entries);
  return <main className="screen home-screen">
    <section className="editorial-cover">
      <div className="issue-line"><span>TODAY</span><span suppressHydrationWarning>{todayLine()}</span></div>
      <div className="cover-head">
        <h1>How are<br />you, <em>really?</em></h1>
        <button className="week-cluster" onClick={openJournal} aria-label="Your week in the journal">
          <span className="week-label">YOUR WEEK</span>
          <span className="week-dots" suppressHydrationWarning>
            {week.flatMap(({ date, letter, entry }, index) => [
              ...(index === 4 ? [<span key="gap" aria-hidden="true" />] : []),
              <span key={date} className={`week-dot ${entry ? "filled" : ""} ${index === 6 ? "today" : ""}`} style={entry ? { background: entry.mood.color } : undefined} title={entry?.title}><i>{letter}</i></span>,
            ])}
          </span>
        </button>
      </div>
      <button className="cover-call" onClick={() => startCall("vent")} aria-label="Call Haan">
        <span className="cover-shape-a" aria-hidden="true" /><span className="cover-shape-b" aria-hidden="true" />
        <span className="cover-mascot"><span className="cover-sun" /><Image src="/vent-listener.png" alt="" width={300} height={300} priority /></span>
        <span className="cover-call-copy"><small>CALL HAAN</small><strong>Talk it out</strong></span>
        <span className="cover-phone"><Icon name="phone" /></span>
      </button>
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
    <div className="privacy-note"><Icon name="shield" /><span>Private by default · runs on this device</span></div>
  </main>;
}
