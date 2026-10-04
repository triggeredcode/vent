import type { ListenerTone } from "@/lib/types";

export type VentScene = "breathe" | "punch";

export type CallPhase = "connecting" | "ringing" | "listening" | "hearing" | "thinking" | "speaking" | "error";

export interface SceneProps {
  /** Where the call is: "hearing" = the caller is talking right now; "speaking" = VENT is talking. */
  phase: CallPhase;
  /** The listener's read of the caller's last line, or null before the first reply. */
  tone: ListenerTone | null;
  muted: boolean;
  /**
   * Live microphone loudness, 0–1, ~23 times a second. It is forced to 0 while VENT speaks,
   * while muted, and during the echo tail, so it only ever reflects the caller. Returns an unsubscribe.
   */
  subscribeLevel: (listener: (level: number) => void) => () => void;
}

/**
 * The scene host element also carries two CSS custom properties, updated every frame:
 *   --level  caller's mic loudness 0–1
 *   --voice  VENT's own speech loudness 0–1 (use it to move the character's mouth while it talks)
 */
export interface SceneModule {
  /** Full-bleed background layer behind everything on the call screen. */
  Backdrop: (props: SceneProps) => React.ReactNode;
  /** The character and props, rendered in the middle of the screen between the header and the controls. */
  Stage: (props: SceneProps) => React.ReactNode;
  /** Class applied to the call screen root; use it (with :global) to restyle the header, timer and controls. */
  theme: string;
  kicker: string;
  /** Idle pose of the character for the home screen card (not used for breathe, which keeps the home mascot). */
  CoverArt: () => React.ReactNode;
  /** Home card colours when this scene is selected. */
  cover: { background: string; ink: string };
}
