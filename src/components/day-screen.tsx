"use client";

import { useState } from "react";
import { Icon } from "./icon";
import { inkFor, monthShort } from "@/lib/mood";
import type { JournalEntry } from "@/lib/types";

type ListKey = "people" | "food" | "places" | "healthMentions";

const groups: { key: ListKey; label: string; tint: string }[] = [
  { key: "people", label: "People", tint: "#f6dfa0" },
  { key: "food", label: "Food", tint: "#f3c3ae" },
  { key: "places", label: "Places", tint: "#c6dcea" },
  { key: "healthMentions", label: "Body", tint: "#d9cdea" },
];

export function DayScreen({ entry, back, onChange, onDeleted }: { entry: JournalEntry; back: () => void; onChange: () => void; onDeleted: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const page = editing ? draft : entry;
  const ink = inkFor(entry.mood.color);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      await fetch(`/api/journal/${encodeURIComponent(entry.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      onChange();
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const { title, journal, summary, people, food, places, healthMentions, highlights, difficultMoments, thingsToRemember } = draft;
    await patch({ title, journal, summary, people, food, places, healthMentions, highlights, difficultMoments, thingsToRemember });
    setEditing(false);
  };

  const remove = async () => {
    await fetch(`/api/journal/${encodeURIComponent(entry.id)}`, { method: "DELETE" });
    onDeleted();
  };

  const dropItem = (key: ListKey | "highlights" | "difficultMoments" | "thingsToRemember", item: string) =>
    setDraft((current) => ({ ...current, [key]: current[key].filter((value) => value !== item) }));

  const detailGroups = groups.filter((group) => page[group.key].length);
  const [lead, ...rest] = page.journal.trim().split(/(?<=[.!?])\s+/);

  return <main className="screen day-screen">
    <div className="day-nav">
      <button className="back-button" onClick={back}><span>‹</span> Journal</button>
      <button className="edit-toggle" onClick={() => { if (editing) { setDraft(entry); setEditing(false); } else { setDraft(entry); setEditing(true); } }}>{editing ? "Cancel" : "Edit"}</button>
    </div>

    <header className="day-hero" style={{ background: entry.mood.color, color: ink }}>
      <span className="hero-shape hero-shape-a" aria-hidden="true" /><span className="hero-shape hero-shape-b" aria-hidden="true" />
      <div className="hero-date"><b>{entry.date.slice(-2)}</b><span>{monthShort(entry.date)}<br />{entry.displayDate.split(",")[0].toUpperCase()}</span></div>
      <span className="hero-mood">A {entry.mood.label} day</span>
      {editing
        ? <input className="edit-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} aria-label="Title" />
        : <h1>{entry.title}</h1>}
      <p>{page.summary}</p>
    </header>

    {page.moodArc.length > 0 && <section className="arc-strip" aria-label="Mood through the day">
      {page.moodArc.map((point, index) => <div key={`${point.phase}-${index}`} className="arc-stop">
        <span className="arc-emoji">{point.emoji}</span><strong>{point.label}</strong><small>{point.phase}</small>
      </div>)}
    </section>}

    {(page.highlights.length > 0 || page.difficultMoments.length > 0) && <section className="stood-out">
      <span className="eyebrow">WHAT STOOD OUT</span>
      <ol>
        {page.highlights.map((item) => <li key={`h-${item}`}><Icon name="sun" /><span>{item}</span>{editing && <button onClick={() => dropItem("highlights", item)} aria-label={`Remove ${item}`}>×</button>}</li>)}
        {page.difficultMoments.map((item) => <li key={`d-${item}`} className="hard"><Icon name="heart" /><span>{item}</span>{editing && <button onClick={() => dropItem("difficultMoments", item)} aria-label={`Remove ${item}`}>×</button>}</li>)}
      </ol>
    </section>}

    {detailGroups.length > 0 && <section className="detail-grid">
      {detailGroups.map((group) => <div key={group.key}>
        <span className="eyebrow">{group.label}</span>
        <div>{page[group.key].map((item) => <span className="tag" style={{ background: group.tint }} key={item}>{item}{editing && <button onClick={() => dropItem(group.key, item)} aria-label={`Remove ${item}`}>×</button>}</span>)}</div>
      </div>)}
    </section>}

    {page.thingsToRemember.length > 0 && <section className="keep-close">
      <span className="eyebrow">KEEP CLOSE</span>
      {page.thingsToRemember.map((item) => <p key={item}>{item}{editing && <button onClick={() => dropItem("thingsToRemember", item)} aria-label={`Remove ${item}`}>×</button>}</p>)}
    </section>}

    <section className="journal-prose">
      <span className="eyebrow">IN YOUR WORDS</span>
      {editing
        ? <textarea value={draft.journal} onChange={(event) => setDraft({ ...draft, journal: event.target.value })} rows={8} aria-label="Journal text" />
        : <p><span className="drop-cap" style={{ background: entry.mood.color, color: ink }}>{lead?.[0]}</span>{lead?.slice(1)} {rest.join(" ")}</p>}
    </section>

    {editing ? <div className="page-actions">
      <button className="page-save" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save page"}</button>
    </div> : <div className="page-actions quiet">
      {entry.transcript && <button onClick={() => void patch({ transcript: null })}>Forget the recording</button>}
      {confirmDelete
        ? <button className="danger" onClick={() => void remove()}>Tap again to delete this page</button>
        : <button onClick={() => setConfirmDelete(true)}>Delete page</button>}
    </div>}
  </main>;
}
