"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./icon";
import { calendarDays, demoEntries, suggestedQuestions } from "@/lib/data";
import { answerFromEntries, makeEntryFromTranscript } from "@/lib/journal";
import { bytesToBase64, encodeMonoWav } from "@/lib/wav";
import type { CallMode, JournalEntry, Screen } from "@/lib/types";

const moodByDay: Record<number, string> = { 2: "#f1d58a", 4: "#c9df9f", 8: "#e8ad9d", 11: "#c9df9f", 16: "#87c7a4", 21: "#f1d58a", 28: "#87c7a4" };

function formatTime(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function playCallRing(context: AudioContext) {
  const now = context.currentTime;
  [0, 0.82].forEach((delay) => {
    const gain = context.createGain();
    const low = context.createOscillator();
    const high = context.createOscillator();
    low.frequency.value = 440;
    high.frequency.value = 520;
    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(0.035, now + delay + 0.04);
    gain.gain.setValueAtTime(0.035, now + delay + 0.28);
    gain.gain.linearRampToValueAtTime(0, now + delay + 0.38);
    low.connect(gain); high.connect(gain); gain.connect(context.destination);
    low.start(now + delay); high.start(now + delay);
    low.stop(now + delay + 0.4); high.stop(now + delay + 0.4);
  });
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
  </main>;
}

function CallScreen({ mode, onEnd }: { mode: CallMode; onEnd: (transcript: string) => void }) {
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState<"connecting" | "ringing" | "listening" | "thinking" | "speaking" | "error">("connecting");
  const [statusText, setStatusText] = useState("Connecting…");
  const [gesture, setGesture] = useState("rest");
  const [attempt, setAttempt] = useState(0);
  const mutedRef = useRef(false);
  const speakerRef = useRef(true);
  const processingRef = useRef(false);
  const speakingRef = useRef(false);

  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { speakerRef.current = speakerOn; }, [speakerOn]);

  const speak = useCallback((text: string) => new Promise<void>((resolve) => {
    if (!speakerRef.current || !("speechSynthesis" in window) || !text) { resolve(); return; }
    speakingRef.current = true;
    setStatus("speaking");
    setStatusText(text);
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => /siri|samantha|veena|rishi/i.test(voice.name)) ?? voices.find((voice) => voice.lang.startsWith("en-IN")) ?? null;
    utterance.rate = 0.92;
    utterance.pitch = 0.96;
    utterance.onend = () => { speakingRef.current = false; resolve(); };
    utterance.onerror = () => { speakingRef.current = false; resolve(); };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }), []);

  const handleAudio = useCallback(async (audio: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setStatus("thinking");
    setStatusText("Listening back…");
    try {
      const response = await fetch("/api/voice/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ audio, format: "wav", mode }),
      });
      const data = await response.json() as { transcript?: string; text?: string; action?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Voice response failed");
      if (data.transcript) setTranscript((current) => `${current} ${data.transcript}`.trim());
      setGesture(data.action ?? "acknowledge");
      await speak(data.text ?? "");
      setGesture("rest");
      setStatus("listening");
      setStatusText("Listening");
    } catch {
      setStatus("error");
      setStatusText("I lost the connection");
    } finally {
      processingRef.current = false;
    }
  }, [mode, speak]);

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    let disposed = false;
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    let processor: ScriptProcessorNode | undefined;
    let source: MediaStreamAudioSourceNode | undefined;
    const chunks: Float32Array[] = [];
    const preRoll: Float32Array[] = [];
    let recording = false;
    let quietFrames = 0;

    const start = async () => {
      setStatus("connecting");
      setStatusText("Connecting…");
      try {
        context = new AudioContext();
        await context.resume();
        const health = await fetch("/api/voice/status", { cache: "no-store" });
        if (!health.ok) throw new Error("Ollama is not ready");
        setStatus("ringing");
        setStatusText("Ringing…");
        playCallRing(context);
        await new Promise((resolve) => window.setTimeout(resolve, 1_650));
        if (disposed) return;
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        if (disposed) { stream.getTracks().forEach((track) => track.stop()); return; }
        source = context.createMediaStreamSource(stream);
        processor = context.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (event) => {
          if (mutedRef.current || processingRef.current || speakingRef.current) return;
          const samples = new Float32Array(event.inputBuffer.getChannelData(0));
          const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
          preRoll.push(samples);
          if (preRoll.length > 4) preRoll.shift();
          if (rms > 0.018) {
            if (!recording) { chunks.push(...preRoll); recording = true; }
            chunks.push(samples);
            quietFrames = 0;
          } else if (recording) {
            chunks.push(samples);
            quietFrames += 1;
            if (quietFrames >= 10) {
              const captured = chunks.splice(0);
              recording = false;
              quietFrames = 0;
              const duration = captured.reduce((total, chunk) => total + chunk.length, 0) / (context?.sampleRate ?? 48_000);
              if (duration >= 0.55) void handleAudio(bytesToBase64(encodeMonoWav(captured, context?.sampleRate ?? 48_000)));
            }
          }
        };
        source.connect(processor);
        processor.connect(context.destination);
        setSeconds(0);
        setStatus("listening");
        setStatusText("Listening");
      } catch (error) {
        if (disposed) return;
        setStatus("error");
        setStatusText(error instanceof DOMException && error.name === "NotAllowedError" ? "Microphone access is needed" : "Ollama is not ready");
      }
    };
    void start();
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.speechSynthesis?.cancel();
      processor?.disconnect();
      source?.disconnect();
      void context?.close();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [attempt, handleAudio]);

  return <main className="call-screen">
    <div className="call-top"><span>{mode === "vent" ? "VENT" : "JOURNAL"}</span><span className="call-secure"><Icon name="shield" /> Local</span></div>
    <div className="call-body"><div className={`listener-orb ${muted ? "muted" : ""} ${status} gesture-${gesture}`}><div className="mascot-glow" /><Image src="/vent-listener.png" alt="VENT listener mascot" width={300} height={300} priority /><i /><i /></div><div className={`call-state ${status}`}><span />{muted ? "Muted" : statusText}</div><div className="timer">{status === "connecting" || status === "ringing" ? "" : formatTime(seconds)}</div>
      {status === "error" && <button className="retry-call" onClick={() => setAttempt((value) => value + 1)}>Try again</button>}
    </div>
    <div className="call-controls"><button onClick={() => setMuted((value) => !value)} className={`call-control ${muted ? "selected" : ""}`}><span><Icon name={muted ? "micOff" : "mic"} /></span>{muted ? "Unmute" : "Mute"}</button><button onClick={() => onEnd(transcript)} className="end-call" aria-label="End call"><Icon name="phone" /></button><button onClick={() => { setSpeakerOn((value) => !value); window.speechSynthesis?.cancel(); }} className={`call-control ${!speakerOn ? "selected" : ""}`}><span><Icon name={speakerOn ? "audio" : "audioOff"} /></span>Audio</button></div>
  </main>;
}

function JournalScreen({ entries, openEntry }: { entries: JournalEntry[]; openEntry: (entry: JournalEntry) => void }) {
  return <main className="screen journal-screen"><section className="journal-title"><span className="eyebrow">YOUR JOURNAL</span><h1>Your days, gently held.</h1></section>
    <section className="calendar-card"><div className="calendar-head"><button aria-label="Previous month">‹</button><h2>October 2026</h2><button aria-label="Next month">›</button></div><div className="weekdays">{["M", "T", "W", "T", "F", "S", "S"].map((day, i) => <span key={`${day}-${i}`}>{day}</span>)}</div><div className="calendar-grid">{calendarDays.map(({ day, currentMonth }, i) => <button key={`${day}-${i}`} className={!currentMonth ? "outside" : day === 4 ? "today" : ""} onClick={() => day === 4 && openEntry(entries[0])}><span>{day}</span>{currentMonth && moodByDay[day] && <i style={{ background: moodByDay[day] }} />}</button>)}</div><div className="calendar-legend"><span><i className="good" />Good</span><span><i className="mixed" />Mixed</span><span><i className="rough" />Rough</span></div></section>
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
