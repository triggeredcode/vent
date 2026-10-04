import { breathe } from "./breathe";
import { punch } from "./punch";
import { sweat } from "./sweat";
import type { SceneModule, VentScene } from "./types";

export type { CallPhase, SceneProps, VentScene } from "./types";

export const scenes: Record<VentScene, SceneModule> = { breathe, punch, sweat };

export const sceneOptions: { id: VentScene; label: string; cover: string }[] = [
  { id: "breathe", label: "Breathe", cover: "Talk it out" },
  { id: "punch", label: "Punch", cover: "Punch it out" },
  { id: "sweat", label: "Sweat", cover: "Sweat it out" },
];
