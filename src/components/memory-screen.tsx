"use client";

import { useState } from "react";
import { Icon } from "./icon";
import { inkFor, localDate } from "@/lib/mood";
import type { JournalEntry } from "@/lib/types";

const suggestions = [
  "When did I last mention Rahul?",
  "What did I eat last Sunday?",
  "How was I feeling during my Bhopal trip?",
  "What made my good days good?",
];

type Answer = { question: string; answer: string; dates: Array<{ id: string; displayDate: string }> };

export function MemoryScreen({ entries, openEntry }: { entries: JournalEntry[]; openEntry: (entry: JournalEntry) => void }) {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState("");
  const [result, setResult] = useState<Answer | null>(null);
  const [failed, setFailed] = useState(false);

  const ask = async (value: string) => {
    const clean = value.trim();
    if (!clean || asking) return;
    setAsking(clean);
    setFailed(false);
    setResult(null);
    try {
      const response = await fetch("/api/memory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: clean, today: localDate() }) });
      const data = await response.json() as Omit<Answer, "question">;
      if (!response.ok) throw new Error("failed");
      setResult({ question: clean, ...data });
      setQuestion("");
    } catch {
      setFailed(true);
    } finally {
      setAsking("");
    }
  };

  const first = result?.dates[0] && entries.find((entry) => entry.id === result.dates[0].id);
  const tone = first ? first.mood.color : "#c7b3dc";

  return <main className="screen memory-screen">
    <div className="issue-line"><span>MEMORIES</span><span>{entries.length} PAGES</span></div>
    <h1 className="memory-headline">Ask your<br /><em>life.</em></h1>

    <section className="memory-cover">
      <span className="memory-shape-a" aria-hidden="true" /><span className="memory-shape-b" aria-hidden="true" /><span className="memory-shape-c" aria-hidden="true" />
      <form className="ask-box" onSubmit={(event) => { event.preventDefault(); void ask(question); }}>
        <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="When did I last…" aria-label="Ask your journal" disabled={Boolean(asking)} />
        <button aria-label="Ask" disabled={Boolean(asking)}><Icon name="arrow" /></button>
      </form>
      <small className="cover-note"><Icon name="shield" />Answers come only from your pages</small>
    </section>

    {asking && <section className="memory-thinking" aria-live="polite">
      <span className="thinking-dots"><i /><i /><i /></span>
      <p>Reading your pages for <em>“{asking}”</em></p>
    </section>}

    {failed && !asking && <p className="memory-failed">Memory needs the journal model running in Ollama. Try again in a moment.</p>}

    {result && !asking && <section className="answer-spread" style={{ background: tone, color: inkFor(tone) }}>
      <span className="quote-mark" aria-hidden="true">“</span>
      <small className="answer-question">{result.question}</small>
      <p>{result.answer}</p>
      {result.dates.length > 0 && <div className="source-dates">
        {result.dates.map((date) => {
          const entry = entries.find((item) => item.id === date.id);
          return <button key={date.id} onClick={() => entry && openEntry(entry)}>{date.displayDate}<Icon name="arrow" /></button>;
        })}
      </div>}
      <button className="ask-another" onClick={() => setResult(null)}>Ask something else</button>
    </section>}

    {!result && !asking && <section className="memory-index">
      <span className="eyebrow">TRY ASKING</span>
      {suggestions.map((item, index) => <button key={item} onClick={() => void ask(item)}><b>{String(index + 1).padStart(2, "0")}</b><span>{item}</span></button>)}
    </section>}
  </main>;
}
