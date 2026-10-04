import { Barlow_Condensed } from "next/font/google";
import type { SceneModule } from "./types";
import { SweatBackdrop } from "./sweat/backdrop";
import { Figure } from "./sweat/figure";
import { HANG_CY, hang, TOP_CY } from "./sweat/rig";
import { SweatStage } from "./sweat/stage";
import styles from "./sweat.module.css";

const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800", "900"], style: ["normal", "italic"], variable: "--sw-font", display: "swap" });

/** Cover pose: near the top of a rep, teeth gritted, sweat flying. */
function coverPose() {
  const p = hang(HANG_CY + (TOP_CY - HANG_CY) * 0.82);
  p.lfx = p.cx - 40; p.lfy = p.cy + 88;
  p.rfx = p.cx + 36; p.rfy = p.cy + 90;
  p.toe = 0.55; p.tilt = -2;
  p.squint = 1; p.grit = 1; p.puff = 0.8; p.effort = 1; p.brow = 1; p.tails = -14;
  p.sx = 1.03; p.sy = 0.97;
  return p;
}

function SweatCover() {
  return <div className={styles.cover}>
    <Figure pose={coverPose()} uid="cover" viewBox="20 54 280 280" align="xMidYMid meet" />
    <svg className={styles.coverDrops} viewBox="20 54 280 280" aria-hidden="true">
      <path d="M0 -8 C4 -3 5.5 1.5 0 6.5 C-5.5 1.5 -4 -3 0 -8Z" transform="translate(84 92) rotate(-50) scale(1.1)" fill="#9fe8ff" stroke="#101014" strokeWidth={1.8} />
      <path d="M0 -8 C4 -3 5.5 1.5 0 6.5 C-5.5 1.5 -4 -3 0 -8Z" transform="translate(238 84) rotate(45) scale(1.25)" fill="#9fe8ff" stroke="#101014" strokeWidth={1.8} />
      <path d="M0 -8 C4 -3 5.5 1.5 0 6.5 C-5.5 1.5 -4 -3 0 -8Z" transform="translate(258 116) rotate(70) scale(.8)" fill="#9fe8ff" stroke="#101014" strokeWidth={1.8} />
    </svg>
  </div>;
}

export const sweat: SceneModule = {
  Backdrop: SweatBackdrop,
  Stage: SweatStage,
  theme: `${styles.theme} ${barlow.variable}`,
  CoverArt: SweatCover,
  cover: { background: "#c6f432", ink: "#111111" },
  kicker: "SWEAT IT OUT",
};
