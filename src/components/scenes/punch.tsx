import type { SceneModule } from "./types";
import styles from "./punch.module.css";

// Placeholder — replaced by the crafted punch scene.
export const punch: SceneModule = {
  Backdrop: () => <div className={styles.backdrop} />,
  Stage: () => <div className={styles.stage} />,
  theme: styles.theme,
  CoverArt: () => <div className={styles.stage} />,
  cover: { background: "#1b0f0e", ink: "#fff4ec" },
  kicker: "PUNCH IT OUT",
};
