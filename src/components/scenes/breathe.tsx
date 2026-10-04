import type { SceneModule } from "./types";
import styles from "./breathe.module.css";

// Placeholder — replaced by the crafted breathe scene.
export const breathe: SceneModule = {
  Backdrop: () => <div className={styles.backdrop} />,
  Stage: () => <div className={styles.stage} />,
  theme: styles.theme,
  CoverArt: () => <div className={styles.stage} />,
  cover: { background: "#f0c947", ink: "#25302b" },
  kicker: "BREATHE IT OUT",
};
