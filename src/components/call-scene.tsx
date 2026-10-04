export type VentScene = "punch" | "sweat" | "breathe";

export const sceneOptions: { id: VentScene; label: string; emoji: string }[] = [
  { id: "punch", label: "Punch", emoji: "🥊" },
  { id: "sweat", label: "Sweat", emoji: "🏋️" },
  { id: "breathe", label: "Breathe", emoji: "🌈" },
];

/** Props around the mascot for each way of letting it out. Pure SVG + CSS; the call phase sets the tempo. */
export function CallScene({ scene }: { scene: VentScene }) {
  if (scene === "punch") return <div className="scene scene-props-punch" aria-hidden="true">
    <svg className="punch-bag" viewBox="0 0 80 220">
      <line x1="40" y1="0" x2="40" y2="44" stroke="currentColor" strokeWidth="3" strokeDasharray="5 4" />
      <rect x="12" y="44" width="56" height="150" rx="26" fill="var(--bag)" />
      <rect x="12" y="74" width="56" height="9" fill="rgba(0,0,0,.18)" />
      <rect x="12" y="156" width="56" height="9" fill="rgba(0,0,0,.18)" />
      <ellipse cx="30" cy="110" rx="6" ry="26" fill="rgba(255,255,255,.22)" />
    </svg>
    <span className="punch-burst"><i /><i /><i /><i /><i /></span>
    <svg className="glove" viewBox="0 0 64 52">
      <path d="M8 18c0-8 7-14 16-14h14c11 0 20 8 20 19v6c0 11-9 19-20 19H24c-9 0-16-6-16-14z" fill="var(--glove)" />
      <path d="M8 22h-3a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h3" fill="var(--glove-cuff)" />
      <path d="M24 12c6 1 10 5 10 11" stroke="rgba(255,255,255,.35)" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  </div>;

  if (scene === "sweat") return <div className="scene scene-props-sweat" aria-hidden="true">
    <svg className="pull-bar" viewBox="0 0 300 60">
      <rect x="10" y="0" width="10" height="60" rx="4" fill="currentColor" opacity=".55" />
      <rect x="280" y="0" width="10" height="60" rx="4" fill="currentColor" opacity=".55" />
      <rect x="6" y="10" width="288" height="9" rx="4.5" fill="currentColor" />
    </svg>
    <span className="sweat-drop d1" /><span className="sweat-drop d2" /><span className="sweat-drop d3" />
    <span className="rep-burst">+1</span>
  </div>;

  return <div className="scene scene-props-breathe" aria-hidden="true">
    <span className="breath-blob b1" /><span className="breath-blob b2" /><span className="breath-blob b3" /><span className="breath-blob b4" />
  </div>;
}
