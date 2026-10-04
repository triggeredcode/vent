"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AfterCall } from "./after-call";
import { CallScreen, type CallResult } from "./call-screen";
import { DayScreen } from "./day-screen";
import { HomeScreen } from "./home-screen";
import { BrandMark } from "./brand";
import { Icon, type IconName } from "./icon";
import { JournalScreen } from "./journal-screen";
import { MemoryScreen } from "./memory-screen";
import type { CallMode, JournalEntry, Screen } from "@/lib/types";

function TopBar({ onHome }: { onHome: () => void }) {
  return <header className="topbar">
    <button className="brand" onClick={onHome} aria-label="Haan home"><BrandMark /><span className="wordmark">haan<i>.</i></span></button>
    <span className="topbar-note">your listening friend</span>
  </header>;
}

function BottomNav({ screen, go }: { screen: Screen; go: (screen: Screen) => void }) {
  const items: { screen: Screen; icon: IconName; label: string; tint: string }[] = [
    { screen: "home", icon: "navHome", label: "Home", tint: "var(--sun)" },
    { screen: "journal", icon: "navJournal", label: "Journal", tint: "var(--sky)" },
    { screen: "memory", icon: "navMemory", label: "Memories", tint: "var(--coral)" },
  ];
  return <nav className="bottom-nav" aria-label="Primary navigation">
    {items.map((item) => <button key={item.screen} onClick={() => go(item.screen)} className={screen === item.screen || (screen === "day" && item.screen === "journal") ? "active" : ""} style={{ "--tint": item.tint } as React.CSSProperties}>
      <span className="nav-icon"><Icon name={item.icon} /></span><span>{item.label}</span>
    </button>)}
  </nav>;
}

export function VentApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [callMode, setCallMode] = useState<CallMode>("vent");
  const [lastCall, setLastCall] = useState<CallResult | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/journal", { cache: "no-store" });
      const data = await response.json() as { entries?: JournalEntry[] };
      setEntries(data.entries ?? []);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // Initial load of saved pages from the journal store.
    void refresh();
  }, [refresh]);

  const navigate = useCallback((next: Screen) => {
    setScreen(next);
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  const startCall = (mode: CallMode) => { setCallMode(mode); setScreen("call"); };
  const openEntry = (entry: JournalEntry) => { setSelectedId(entry.id); navigate("day"); };
  const finishCall = (result: CallResult) => { setLastCall(result); setScreen("after-call"); };
  const pageWritten = (entry: JournalEntry) => {
    setEntries((current) => [entry, ...current.filter((item) => item.id !== entry.id)].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
    openEntry(entry);
  };

  const selected = entries.find((entry) => entry.id === selectedId);
  const fullBleed = screen === "call" || screen === "after-call";

  let content: React.ReactNode = <HomeScreen entries={entries} startCall={startCall} openEntry={openEntry} openJournal={() => navigate("journal")} />;
  if (screen === "journal") content = <JournalScreen entries={entries} loaded={loaded} openEntry={openEntry} startCall={startCall} />;
  if (screen === "memory") content = <MemoryScreen entries={entries} openEntry={openEntry} />;
  if (screen === "day" && selected) content = <DayScreen key={selected.id} entry={selected} back={() => navigate("journal")} onChange={refresh} onDeleted={() => { void refresh(); navigate("journal"); }} />;

  return <div className={`app-shell screen-${screen}`}>
    {screen === "call" && <CallScreen mode={callMode} onEnd={finishCall} />}
    {screen === "after-call" && lastCall && <AfterCall call={lastCall} onDone={() => navigate("home")} onWritten={pageWritten} />}
    {!fullBleed && <>
      <TopBar onHome={() => navigate("home")} />
      <div className="screen-scroll" ref={scrollRef}>{content}</div>
      <BottomNav screen={screen} go={navigate} />
    </>}
  </div>;
}
