import { Barlow_Condensed } from "next/font/google";
import Image from "next/image";
import type { SceneModule } from "./types";
import { SweatBackdrop } from "./sweat/backdrop";
import { COVER_SRC, SweatStage } from "./sweat/stage";
import styles from "./sweat.module.css";

const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800", "900"], style: ["normal", "italic"], variable: "--sw-font", display: "swap" });

/** Home card: a still render of the 3D gym buddy mid jumping-jack (see scripts in public/models/CREDITS.md). */
function SweatCover() {
  return <div className={styles.cover}>
    <Image src={COVER_SRC} alt="" width={600} height={600} unoptimized />
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
