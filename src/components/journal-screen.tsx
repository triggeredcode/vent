"use client";

import { useMemo, useState } from "react";
import { Icon } from "./icon";
import { inkFor, localDate, moodPalette } from "@/lib/mood";
import type { CallMode, JournalEntry } from "@/lib/types";

const blobs = [
  "48% 52% 44% 56% / 55% 45% 55% 45%",
  "60% 40% 52% 48% / 46% 58% 42% 54%",
  "42% 58% 60% 40% / 52% 40% 60% 48%",
  "55% 45% 38% 62% / 60% 52% 48% 40%",
];

const storyShapes = ["2px 26px 2px 26px", "26px 2px 26px 2px", "2px 2px 40px 2px", "40px 2px 2px 2px"];

function topOf(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
}

export function JournalScreen({ entries, loaded, openEntry, startCall }: { entries: JournalEntry[]; loaded: boolean; openEntry: (entry: JournalEntry) => void; startCall: (mode: CallMode) => void }) {
  const today = localDate();
  const [cursor, setCursor] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }));
  const monthKey = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;
  const monthName = new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-IN", { month: "long" });
  const monthEntries = entries.filter((entry) => entry.date.startsWith(monthKey));
  const byDay = useMemo(() => {
    const map = new Map<number, JournalEntry>();
    // Entries arrive newest first; keep the latest page for each day.
    entries.filter((entry) => entry.date.startsWith(monthKey)).forEach((entry) => { const day = Number(entry.date.slice(8)); if (!map.has(day)) map.set(day, entry); });
    return map;
  }, [entries, monthKey]);

  const lead = (new Date(cursor.year, cursor.month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  const shift = (delta: number) => setCursor(({ year, month }) => { const next = new Date(year, month + delta, 1); return { year: next.getFullYear(), month: next.getMonth() }; });

  const brightDays = monthEntries.filter((entry) => entry.mood.score >= 4).length;
  const person = topOf(monthEntries.flatMap((entry) => entry.people));
  const food = topOf(monthEntries.flatMap((entry) => entry.food));

  return <main className="screen journal-screen">
    <div className="issue-line"><span>THE JOURNAL</span><span>{cursor.year}</span></div>
    <section className="journal-masthead">
      <span className="masthead-shape" aria-hidden="true" />
      <h1>{monthName}</h1>
      <div className="month-nav"><button onClick={() => shift(-1)} aria-label="Previous month">‹</button><button onClick={() => shift(1)} aria-label="Next month">›</button></div>
    </section>

    <section className="painted-calendar" aria-label={`${monthName} calendar`}>
      <div className="weekdays">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
      <div className="calendar-grid">
        {cells.map((day, index) => {
          if (!day) return <span key={`lead-${index}`} />;
          const entry = byDay.get(day);
          const isToday = `${monthKey}-${String(day).padStart(2, "0")}` === today;
          return <button key={day} disabled={!entry} className={`${entry ? "painted" : ""} ${isToday ? "today" : ""}`} onClick={() => entry && openEntry(entry)} aria-label={entry ? `${day}: ${entry.title}` : String(day)}
            style={entry ? { background: entry.mood.color, color: inkFor(entry.mood.color), borderRadius: blobs[day % blobs.length] } : undefined}>{day}</button>;
        })}
      </div>
      <div className="mood-key">{([5, 4, 3, 2, 1] as const).map((score) => <span key={score}><i style={{ background: moodPalette[score].color }} />{moodPalette[score].label}</span>)}</div>
    </section>

    {monthEntries.length > 0 && <section className="month-glance">
      <div><b>{String(monthEntries.length).padStart(2, "0")}</b><small>pages</small></div>
      <div><b>{String(brightDays).padStart(2, "0")}</b><small>good days</small></div>
      {person && <div><b className="glance-word">{person[0]}</b><small>most mentioned</small></div>}
      {!person && food && <div><b className="glance-word">{food[0]}</b><small>most eaten</small></div>}
    </section>}

    <section className="journal-stories">
      <div className="stories-head"><span>PAGES</span><i>{String(monthEntries.length).padStart(2, "0")}</i></div>
      {loaded && monthEntries.length === 0 && <button className="journal-empty" onClick={() => startCall("journal")}>
        <span className="empty-shape" aria-hidden="true" />
        <small>NOTHING HERE YET</small><strong>Call and tell me<br />about your day</strong><Icon name="arrow" />
      </button>}
      {monthEntries.map((entry, index) => <button className="journal-story" key={entry.id} onClick={() => openEntry(entry)}
        style={{ background: entry.mood.color, color: inkFor(entry.mood.color), borderRadius: storyShapes[index % storyShapes.length] }}>
        <span className="story-date"><b>{entry.date.slice(-2)}</b><small>{entry.displayDate.split(",")[0].slice(0, 3).toUpperCase()}</small></span>
        <span className="story-copy"><small>{entry.mood.label.toUpperCase()}{entry.people[0] ? ` · ${entry.people.slice(0, 2).join(" & ").toUpperCase()}` : ""}</small><strong>{entry.title}</strong></span>
        <span className="story-arrow"><Icon name="arrow" /></span>
      </button>)}
    </section>
  </main>;
}
