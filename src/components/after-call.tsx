"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { localDate } from "@/lib/mood";
import type { JournalEntry } from "@/lib/types";
import type { CallResult } from "./call-screen";

const duration = (seconds: number) => seconds < 60 ? `${seconds} sec` : `${Math.floor(seconds / 60)} min ${seconds % 60 ? `${seconds % 60} sec` : ""}`.trim();

export function AfterCall({ call, onDone, onWritten }: { call: CallResult; onDone: () => void; onWritten: (entry: JournalEntry) => void }) {
  const spoke = call.turns.some((turn) => turn.speaker === "you");
  const [state, setState] = useState<"choice" | "writing" | "error" | "tossing">(call.mode === "journal" && spoke ? "writing" : "choice");
  const started = useRef(false);

  const write = useCallback(async () => {
    setState("writing");
    try {
      const response = await fetch("/api/journal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ turns: call.turns, date: localDate(), keepTranscript: call.mode === "journal" }),
      });
      const data = await response.json() as { entry?: JournalEntry };
      if (!response.ok || !data.entry) throw new Error("write failed");
      onWritten(data.entry);
    } catch {
      setState("error");
    }
  }, [call, onWritten]);

  const letGo = () => {
    setState("tossing");
    window.setTimeout(onDone, 2300);
  };

  useEffect(() => {
    if (state === "writing" && !started.current) { started.current = true; void write(); }
  }, [state, write]);

  return <main className={`after-call after-${state}`}>
    <div className="poster-art" aria-hidden="true"><span className="shape-sun" /><span className="shape-moon" /><span className="shape-ring" /><span className="shape-leaf" /><span className="shape-dot" /></div>
    <div className="after-top"><span>CALL ENDED</span><span>{duration(call.seconds)}</span></div>

    {state === "tossing" && <section className="toss" aria-live="polite">
      <div className="toss-stage" aria-hidden="true">
        <span className="toss-flight"><span className="toss-paper"><i /><i /><i /><i /></span></span>
        <svg className="toss-bin" viewBox="0 0 90 100">
          <path className="bin-lid" d="M8 18h74M34 18v-7h22v7" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M16 30h58l-6 62H22z" fill="currentColor" />
          <path d="M34 42v38M45 42v38M56 42v38" stroke="var(--paper)" strokeWidth="4" strokeLinecap="round" opacity=".5" />
        </svg>
      </div>
      <h1>Let <em>go.</em></h1>
      <p>Nothing from this call was kept.</p>
    </section>}

    {state === "writing" && <section className="after-copy">
      <div className="writing-mark"><Image src="/vent-listener.png" alt="" width={190} height={190} /></div>
      <h1>Writing<br />today&apos;s <em>page…</em></h1>
      <p>Only what you said. Nothing more.</p>
    </section>}

    {state === "error" && <section className="after-copy">
      <h1>The page<br />didn&apos;t <em>take.</em></h1>
      <p>The journal model didn&apos;t answer. Your call is still here.</p>
      <div className="after-actions"><button className="after-primary" onClick={() => { started.current = false; setState("writing"); }}>Try again</button><button className="after-quiet" onClick={onDone}>Let it go</button></div>
    </section>}

    {state === "choice" && <section className="after-copy">
      <div className="writing-mark"><Image src="/vent-listener.png" alt="" width={190} height={190} /></div>
      {spoke ? <>
        <h1>Feel a little<br /><em>lighter?</em></h1>
        <p>Nothing from this call is kept unless you want it to be.</p>
        <div className="after-actions">
          <button className="after-primary" onClick={letGo}>Let it go</button>
          <button className="after-quiet" onClick={() => void write()}>Keep it as a page</button>
        </div>
      </> : <>
        <h1>Another<br /><em>time.</em></h1>
        <p>VENT is here whenever you want to talk.</p>
        <div className="after-actions"><button className="after-primary" onClick={onDone}>Back home</button></div>
      </>}
    </section>}
  </main>;
}
