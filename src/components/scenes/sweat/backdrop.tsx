"use client";

import { useEffect, useRef } from "react";
import type { SceneProps } from "../types";
import styles from "../sweat.module.css";

const ticker = ["Sweat it out", "Burn it off", "One more rep", "Leave it on the bar", "No days off", "Breathe · Lift · Repeat"];
const speed = [
  { top: 18, left: 2, width: 22 }, { top: 24, left: 70, width: 30 }, { top: 33, left: -4, width: 16 },
  { top: 41, left: 80, width: 26 }, { top: 49, left: 4, width: 28 }, { top: 56, left: 74, width: 18 },
  { top: 62, left: -2, width: 20 },
];

/** Stadium poster: lime field, jersey stripes, halftone, a huge outlined SWEAT and a cobalt track with an LED board. */
export function SweatBackdrop({ subscribeLevel }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let smooth = 0;
    return subscribeLevel((level) => {
      smooth += (level - smooth) * 0.35;
      ref.current?.style.setProperty("--lvl", smooth.toFixed(3));
    });
  }, [subscribeLevel]);

  const line = ticker.map((word) => <span key={word}>{word}<b>✦</b></span>);

  return <div ref={ref} className={styles.backdrop}>
    <div className={styles.halftone} />
    <div className={styles.stripes}><i /><i /><i /></div>
    <div className={styles.bigWord}><span>Sweat</span><span>Sweat</span></div>
    <div className={styles.speed}>
      {speed.map((s, index) => <i key={index} style={{ top: `${s.top}%`, left: `${s.left}%`, width: `${s.width}%`, animationDelay: `${index * -0.37}s` }} />)}
    </div>
    <div className={styles.track}>
      <div className={styles.board}><div className={styles.boardRun}>{line}{line}</div></div>
      <div className={styles.lanes}><div className={styles.laneFloor} /></div>
    </div>
  </div>;
}
