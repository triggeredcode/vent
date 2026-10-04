import type { SceneModule } from "./types";
import styles from "./sweat.module.css";

// Placeholder — replaced by the crafted sweat scene.
export const sweat: SceneModule = {
  Backdrop: () => <div className={styles.backdrop} />,
  Stage: () => <div className={styles.stage} />,
  theme: styles.theme,
  CoverArt: () => <div className={styles.stage} />,
  cover: { background: "#c6f432", ink: "#111111" },
  kicker: "SWEAT IT OUT",
};
