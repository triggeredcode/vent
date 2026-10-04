"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./icon";
import { calendarDays, demoEntries, suggestedQuestions } from "@/lib/data";
import { answerFromEntries, makeEntryFromTranscript } from "@/lib/journal";
import type { CallMode, JournalEntry, Screen } from "@/lib/types";

interface SpeechResultEvent extends Event { results: ArrayLike<{ 0: { transcript: string } }> }
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const moodByDay: Record<number, string> = { 2: "#f1d58a", 4: "#c9df9f", 8: "#e8ad9d", 11: "#c9df9f", 16: "#87c7a4", 21: "#f1d58a", 28: "#87c7a4" };

function formatTime(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function Brand() {
  return <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="VENT home"><span className="brand-mark">V</span><span>VENT</span></button>;
}

function TopBar({ onHome }: { onHome: () => void }) {
  return <header className="topbar"><div onClick={onHome}><Brand /></div><button className="avatar" aria-label="Profile">O</button></header>;
}

function BottomNav({ screen, go }: { screen: Screen; go: (screen: Screen) => void }) {
  const items: { screen: Screen; icon: IconName; label: string }[] = [
    { screen: "home", icon: "home", label: "Home" },
    { screen: "journal", icon: "book", label: "Journal" },
    { screen: "memory", icon: "spark", label: "Memories" },
  ];
  return <nav className="bottom-nav" aria-label="Primary navigation">{items.map((item) => <button key={item.screen} onClick={() => go(item.screen)} className={screen === item.screen || (screen === "day" && item.screen === "journal") ? "active" : ""}><Icon name={item.icon} /><span>{item.label}</span></button>)}</nav>;
}

function HomeScreen({ startCall, openEntry }: { startCall: (mode: CallMode) => void; openEntry: (entry: JournalEntry) => void }) {
  return <main className="screen home-screen">
    <section className="welcome"><span className="eyebrow">SUNDAY, 4 OCTOBER</span><h1>Hey there,</h1><p>What would feel good right now?</p></section>
    <section className="mode-grid">
      <button className="mode-card vent-card" onClick={() => startCall("vent")}>
        <span className="mode-icon"><Icon name="phone" /></span><span><strong>Vent</strong><small>Just talk. I&apos;ll listen.</small></span><Icon className="card-arrow" name="arrow" />
      </button>
      <button className="mode-card journal-card" onClick={() => startCall("journal")}>
        <span className="mode-icon"><Icon name="book" /></span><span><strong>Journal</strong><small>Talk your day through.</small></span><Icon className="card-arrow" name="arrow" />
      </button>
    </section>
    <div className="privacy-note"><Icon name="shield" /><span>Your conversations stay private. Vent calls aren&apos;t saved unless you choose to.</span></div>
    <section className="recent-section"><div className="section-heading"><div><span className="eyebrow">YOUR DAYS</span><h2>Recent moments</h2></div><button onClick={() => openEntry(demoEntries[0])}>View journal <Icon name="arrow" /></button></div>
      <div className="moments-list">{demoEntries.slice(0, 2).map((entry) => <button className="moment" key={entry.id} onClick={() => openEntry(entry)}><span className="mood-dot" style={{ background: entry.mood.color }} /><span className="moment-copy"><strong>{entry.displayDate}</strong><small>{entry.summary}</small></span><Icon name="chevron" /></button>)}</div>
    </section>
    <section className="memory-tease"><div className="memory-art"><span /><span /><span /></div><div><span className="eyebrow">A QUIET PATTERN</span><h3>Walks have helped lately.</h3><p>You sounded lighter on two days that included an evening walk.</p></div></section>
  </main>;
}

function CallScreen({ mode, onEnd }: { mode: CallMode; onEnd: (transcript: string) => void }) {
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [speechStatus, setSpeechStatus] = useState("Listening");
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  const handleTurn = useCallback(async (message: string) => {
    if (!message.trim()) return;
    setSpeechStatus("…");
    try {
      const response = await fetch("/api/listener", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, mode }),
      });
      const data = await response.json() as { text?: string };
      if (!data.text) { setSpeechStatus("Listening"); return; }
      setSpeechStatus(data.text);
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(data.text);
        utterance.rate = 0.94;
        utterance.pitch = 0.92;
        utterance.onend = () => setSpeechStatus("Listening");
        window.speechSynthesis.speak(utterance);
      } else {
        globalThis.setTimeout(() => setSpeechStatus("Listening"), 1700);
      }
    } catch {
      setSpeechStatus("Hmm… I'm here.");
      window.setTimeout(() => setSpeechStatus("Listening"), 1700);
    }
  }, [mode]);

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    const speechWindow = window as typeof window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (Recognition) {
      const instance = new Recognition();
      instance.continuous = true;
      instance.interimResults = false;
      instance.lang = "en-IN";
      instance.onresult = (event) => {
        const latest = event.results[event.results.length - 1]?.[0]?.transcript ?? "";
        setTranscript((value) => `${value} ${latest}`.trim());
        void handleTurn(latest);
      };
      instance.onerror = () => setSpeechStatus("Listening quietly");
      recognition.current = instance;
      try { instance.start(); } catch {}
    }
    return () => { window.clearInterval(timer); try { recognition.current?.stop(); } catch {} };
  }, [handleTurn]);

  const toggleMute = () => {
    if (muted) { try { recognition.current?.start(); } catch {} } else { try { recognition.current?.stop(); } catch {} }
    setMuted((value) => !value);
  };

  return <main className="call-screen">
    <div className="call-top"><span>{mode === "vent" ? "Vent" : "Journal"}</span><button aria-label="More options"><Icon name="more" /></button></div>
    <div className="call-body"><div className={`listener-orb ${muted ? "muted" : ""}`}><span className="orb-core">V</span><i /><i /><i /></div><h1>{muted ? "Muted" : speechStatus}</h1><p>{mode === "vent" ? "Take your time. There’s no rush." : "Tell me about your day, in your own way."}</p><div className="timer">{formatTime(seconds)}</div>
      <div className="wave" aria-hidden="true">{Array.from({ length: 21 }, (_, i) => <span key={i} style={{ height: muted ? 3 : `${8 + ((i * 13) % 31)}px`, animationDelay: `${i * -0.07}s` }} />)}</div>
    </div>
    <div className="call-fallback"><label htmlFor="demo-line">Demo fallback · press Enter to speak</label><input id="demo-line" value={transcript} onChange={(event) => setTranscript(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleTurn(transcript); }} placeholder="Type a line if speech recognition is unavailable…" /></div>
    <div className="call-controls"><button onClick={toggleMute} className="call-control"><span><Icon name={muted ? "micOff" : "mic"} /></span>{muted ? "Unmute" : "Mute"}</button><button onClick={() => onEnd(transcript)} className="end-call" aria-label="End call"><Icon name="phone" /></button><button className="call-control"><span><Icon name="spark" /></span>Hold</button></div>
  </main>;
}

function JournalScreen({ entries, openEntry }: { entries: JournalEntry[]; openEntry: (entry: JournalEntry) => void }) {
  return <main className="screen journal-screen"><section className="journal-title"><span className="eyebrow">YOUR JOURNAL</span><h1>A picture of your life</h1><p>Every day you share adds another little piece.</p></section>
    <section className="calendar-card"><div className="calendar-head"><button aria-label="Previous month">‹</button><h2>October 2026</h2><button aria-label="Next month">›</button></div><div className="weekdays">{["M", "T", "W", "T", "F", "S", "S"].map((day, i) => <span key={`${day}-${i}`}>{day}</span>)}</div><div className="calendar-grid">{calendarDays.map(({ day, currentMonth }, i) => <button key={`${day}-${i}`} className={!currentMonth ? "outside" : day === 4 ? "today" : ""} onClick={() => day === 4 && openEntry(entries[0])}><span>{day}</span>{currentMonth && moodByDay[day] && <i style={{ background: moodByDay[day] }} />}</button>)}</div><div className="calendar-legend"><span><i className="good" />Good</span><span><i className="mixed" />Mixed</span><span><i className="rough" />Rough</span></div></section>
    <section className="month-note"><span>October, so far</span><strong>“More focused than last week, with quieter evenings.”</strong><small>Based only on what you shared.</small></section>
    <section className="entry-list"><div className="section-heading"><div><span className="eyebrow">LATEST</span><h2>Journal entries</h2></div></div>{entries.map((entry) => <button className="entry-row" key={entry.id} onClick={() => openEntry(entry)}><span className="entry-date"><strong>{entry.date.slice(-2)}</strong><small>{new Date(`${entry.date}T12:00:00`).toLocaleDateString("en", { month: "short" }).toUpperCase()}</small></span><span><strong>{entry.mood.label[0].toUpperCase() + entry.mood.label.slice(1)} day</strong><small>{entry.highlights[0]}</small></span><span className="entry-mood" style={{ background: entry.mood.color }} /></button>)}</section>
  </main>;
}

function DayScreen({ entry, back }: { entry: JournalEntry; back: () => void }) {
  const detailGroups = [
    { label: "People", items: entry.people }, { label: "Food", items: entry.food }, { label: "Places", items: entry.places }, { label: "Health", items: entry.healthMentions },
  ].filter((group) => group.items.length);
  return <main className="screen day-screen"><button className="back-button" onClick={back}>‹ <span>Journal</span></button><header className="day-header"><span className="eyebrow">{entry.displayDate.toUpperCase()}</span><h1>A {entry.mood.label} day.</h1><p>{entry.summary}</p></header>
    <section className="day-card mood-arc"><span className="eyebrow">MOOD ARC</span><div>{entry.moodArc.map((point, index) => <div key={point.phase} className="arc-point"><span>{point.emoji}</span><strong>{point.label}</strong><small>{point.phase}</small>{index < entry.moodArc.length - 1 && <i>→</i>}</div>)}</div></section>
    {entry.highlights.length > 0 && <section className="day-card highlight-card"><span className="eyebrow">WHAT STOOD OUT</span>{entry.highlights.map((item) => <div key={item}><Icon name="sun" /><span>{item}</span></div>)}{entry.difficultMoments.map((item) => <div key={item}><Icon name="heart" /><span>{item}</span></div>)}</section>}
    {detailGroups.length > 0 && <section className="day-card details-card">{detailGroups.map((group) => <div key={group.label}><span className="eyebrow">{group.label}</span><div>{group.items.map((item) => <span className="tag" key={item}>{item}</span>)}</div></div>)}</section>}
    {entry.thingsToRemember.length > 0 && <section className="remember-card"><Icon name="spark" /><div><span className="eyebrow">KEEP CLOSE</span>{entry.thingsToRemember.map((item) => <p key={item}>{item}</p>)}</div></section>}
    <section className="journal-prose"><span className="eyebrow">THE DAY, IN YOUR WORDS</span><p>{entry.summary}</p></section>
  </main>;
}

function MemoryScreen({ entries }: { entries: JournalEntry[] }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<{ answer: string; dates: string[] } | null>(null);
  const ask = useCallback((value: string) => { const clean = value.trim(); if (!clean) return; setQuestion(clean); setResult(answerFromEntries(clean, entries)); }, [entries]);
  return <main className="screen memory-screen"><section className="memory-hero"><div className="memory-orbit"><Icon name="spark" /></div><span className="eyebrow">ASK YOUR LIFE</span><h1>Your days remember.</h1><p>Ask anything about the moments you&apos;ve shared. Answers only use your journal.</p></section>
    <form className="ask-box" onSubmit={(event) => { event.preventDefault(); ask(question); }}><Icon name="search" /><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What do you want to remember?" aria-label="Ask your journal" /><button aria-label="Ask"><Icon name="arrow" /></button></form>
    {!result && <section className="suggestions"><span className="eyebrow">TRY ASKING</span>{suggestedQuestions.map((item) => <button key={item} onClick={() => ask(item)}>{item}<Icon name="arrow" /></button>)}</section>}
    {result && <section className="answer-card"><div className="answer-mark"><Icon name="spark" /></div><span className="eyebrow">FROM YOUR JOURNAL</span><p>{result.answer}</p>{result.dates.length > 0 && <div className="source-dates"><span>Days used</span>{result.dates.map((date) => <button key={date}>{date}</button>)}</div>}<button className="ask-another" onClick={() => { setResult(null); setQuestion(""); }}>Ask something else</button></section>}
    <div className="grounding-note"><Icon name="shield" />VENT won&apos;t guess. If it isn&apos;t in your journal, it says so.</div>
  </main>;
}

export function VentApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [callMode, setCallMode] = useState<CallMode>("vent");
  const [entries, setEntries] = useState<JournalEntry[]>(() => {
    if (typeof window === "undefined") return demoEntries;
    const saved = window.localStorage.getItem("vent-journal");
    if (!saved) return demoEntries;
    try { return JSON.parse(saved) as JournalEntry[]; } catch { return demoEntries; }
  });
  const [selected, setSelected] = useState<JournalEntry>(demoEntries[0]);

  useEffect(() => { window.localStorage.setItem("vent-journal", JSON.stringify(entries)); }, [entries]);

  const startCall = (mode: CallMode) => { setCallMode(mode); setScreen("call"); };
  const openEntry = (entry: JournalEntry) => { setSelected(entry); setScreen("day"); window.scrollTo(0, 0); };
  const finishCall = (transcript: string) => {
    const newEntry = makeEntryFromTranscript(transcript);
    if (callMode === "journal") setEntries((current) => [newEntry, ...current]);
    setSelected(callMode === "journal" ? newEntry : demoEntries[0]);
    setScreen(callMode === "journal" ? "day" : "home");
  };
  let content = <HomeScreen startCall={startCall} openEntry={openEntry} />;
  if (screen === "call") content = <CallScreen mode={callMode} onEnd={finishCall} />;
  if (screen === "journal") content = <JournalScreen entries={entries} openEntry={openEntry} />;
  if (screen === "memory") content = <MemoryScreen entries={entries} />;
  if (screen === "day") content = <DayScreen entry={selected} back={() => setScreen("journal")} />;

  return <div className={`app-shell ${screen === "call" ? "in-call" : ""}`}>{screen !== "call" && <TopBar onHome={() => setScreen("home")} />}{content}{screen !== "call" && <BottomNav screen={screen} go={setScreen} />}</div>;
}
