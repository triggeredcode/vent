import styles from "../punch.module.css";

/**
 * The little devil boxer. Drawn facing right in a local space whose origin is the point
 * between its feet (y grows downwards, so the body lives at negative y).
 * Every moving part sits under its own pivot group so the engine can pose it with plain
 * SVG transform attributes.
 */

export type Point = { x: number; y: number };

export const HIP: Point = { x: 2, y: -86 };
export const SHOULDER = { lead: { x: 22, y: -140 }, rear: { x: -12, y: -142 } };
export const GUARD = {
  fight: { lead: { x: 72, y: -162 }, rear: { x: 46, y: -136 } },
  speak: { lead: { x: 78, y: -166 }, rear: { x: -54, y: -160 } },
  think: { lead: { x: 58, y: -100 }, rear: { x: 30, y: -96 } },
};

const OUTLINE = "#1d0604";

/** A curved, slightly bent arm from shoulder to glove. */
export function armPath(s: Point, g: Point, bend = 1): string {
  const mx = (s.x + g.x) / 2;
  const my = (s.y + g.y) / 2;
  const dx = g.x - s.x;
  const dy = g.y - s.y;
  const len = Math.hypot(dx, dy) || 1;
  // Elbow drops below the line between shoulder and glove.
  const k = 14 * bend;
  const cx = mx + (-dy / len) * -k * Math.sign(dx || 1);
  const cy = my + (dx / len) * k * Math.sign(dx || 1);
  return `M${s.x.toFixed(1)} ${s.y.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${g.x.toFixed(1)} ${g.y.toFixed(1)}`;
}

export function gloveTransform(s: Point, g: Point, extra = 0, mirror = false): string {
  const angle = (Math.atan2(g.y - s.y, g.x - s.x) * 180) / Math.PI;
  const a = angle + extra;
  return `translate(${g.x.toFixed(1)} ${g.y.toFixed(1)}) rotate(${a.toFixed(1)})${mirror ? " scale(1 -1)" : ""}`;
}


export function DevilDefs({ id }: { id: string }) {
  return <>
    <radialGradient id={`${id}-skin`} cx="0.36" cy="0.3" r="0.8">
      <stop offset="0" stopColor="#ff7a55" />
      <stop offset="0.42" stopColor="#e8291c" />
      <stop offset="0.85" stopColor="#a50f0a" />
      <stop offset="1" stopColor="#7c0806" />
    </radialGradient>
    <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#ff5236" />
      <stop offset="0.55" stopColor="#d81f15" />
      <stop offset="1" stopColor="#8a0b07" />
    </linearGradient>
    <radialGradient id={`${id}-belly`} cx="0.45" cy="0.4" r="0.6">
      <stop offset="0" stopColor="#ffa07a" stopOpacity="0.85" />
      <stop offset="1" stopColor="#ff6a45" stopOpacity="0" />
    </radialGradient>
    <linearGradient id={`${id}-horn`} x1="0" y1="1" x2="0.2" y2="0">
      <stop offset="0" stopColor="#8f5326" />
      <stop offset="0.45" stopColor="#e9bd7f" />
      <stop offset="1" stopColor="#fff6df" />
    </linearGradient>
    <radialGradient id={`${id}-glove`} cx="0.62" cy="0.3" r="0.85">
      <stop offset="0" stopColor="#fff3c2" />
      <stop offset="0.22" stopColor="#ffd04a" />
      <stop offset="0.62" stopColor="#f39a12" />
      <stop offset="1" stopColor="#a8470a" />
    </radialGradient>
    <linearGradient id={`${id}-shorts`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#3a1020" />
      <stop offset="1" stopColor="#150409" />
    </linearGradient>
    <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#ffe48a" />
      <stop offset="1" stopColor="#e39a16" />
    </linearGradient>
    <linearGradient id={`${id}-boot`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#3b1118" />
      <stop offset="1" stopColor="#12040a" />
    </linearGradient>
  </>;
}

function Glove({ id }: { id: string }) {
  return <g className={styles.gloveArt}>
    <path d="M-44 -15 Q-47 0 -44 15 L-22 18 L-22 -18 Z" fill="#fff1dc" stroke={OUTLINE} strokeWidth="3.5" strokeLinejoin="round" />
    <path d="M-36 -16 L-36 16" stroke="#d81e10" strokeWidth="4.5" />
    <path d="M-28 -20 C-18 -33 14 -34 27 -20 C36 -10 36 11 27 21 C16 32 -14 32 -27 20 C-33 11 -33 -11 -28 -20 Z" fill={`url(#${id}-glove)`} stroke={OUTLINE} strokeWidth="4" strokeLinejoin="round" />
    <path d="M-22 -18 C-16 -29 0 -29 4 -19 C0 -10 -14 -9 -22 -18 Z" fill="#ffd96a" stroke={OUTLINE} strokeWidth="2.6" strokeLinejoin="round" />
    <path d="M-18 7 C-6 12 10 12 22 6" fill="none" stroke="#a8470a" strokeWidth="2.4" strokeLinecap="round" opacity="0.7" />
    <ellipse cx="12" cy="-16" rx="11" ry="4.5" fill="#fff" opacity="0.6" transform="rotate(12 12 -16)" />
    <circle cx="26" cy="-6" r="2.4" fill="#fff" opacity="0.8" />
  </g>;
}

function Streak() {
  return <g opacity="0" stroke="#ffd36b" strokeLinecap="round">
    <path d="M-60 -14 L-110 -16" strokeWidth="3" />
    <path d="M-56 2 L-128 1" strokeWidth="4" />
    <path d="M-60 16 L-104 18" strokeWidth="2.5" />
  </g>;
}

/** Static pose used for the first render (and the cover art). */
export function guardPose(kind: keyof typeof GUARD = "fight") {
  const g = GUARD[kind];
  return {
    leadArm: armPath(SHOULDER.lead, g.lead),
    rearArm: armPath(SHOULDER.rear, g.rear),
    leadGlove: gloveTransform(SHOULDER.lead, g.lead),
    rearGlove: gloveTransform(SHOULDER.rear, g.rear, 0, kind === "speak"),
  };
}

export function Devil({ id, pose = "fight" }: { id: string; pose?: keyof typeof GUARD }) {
  const p = guardPose(pose);
  return <g className={styles.devil}>
    {/* Tail */}
    <g transform="translate(-30 -76)">
      <g data-part="tail" className={styles.tail}>
        <path d="M0 0 C-36 8 -64 -4 -62 -36 S-42 -78 -66 -98" fill="none" stroke={OUTLINE} strokeWidth="13" strokeLinecap="round" />
        <path d="M0 0 C-36 8 -64 -4 -62 -36 S-42 -78 -66 -98" fill="none" stroke="#c71a12" strokeWidth="6.5" strokeLinecap="round" />
        <path transform="translate(-68 -100) rotate(-28)" d="M0 -28 C7 -15 20 -9 16 2 C12 9 4 8 0 3 C-4 8 -12 9 -16 2 C-20 -9 -7 -15 0 -28 Z" fill={`url(#${id}-body)`} stroke={OUTLINE} strokeWidth="3.5" strokeLinejoin="round" />
      </g>
    </g>

    {/* Legs + boots */}
    <path d="M-16 -62 Q-26 -40 -30 -22" fill="none" stroke={OUTLINE} strokeWidth="23" strokeLinecap="round" />
    <path d="M-16 -62 Q-26 -40 -30 -22" fill="none" stroke="#b4170f" strokeWidth="16" strokeLinecap="round" />
    <path d="M20 -62 Q28 -40 30 -22" fill="none" stroke={OUTLINE} strokeWidth="23" strokeLinecap="round" />
    <path d="M20 -62 Q28 -40 30 -22" fill="none" stroke="#dc2416" strokeWidth="16" strokeLinecap="round" />
    <g fill={`url(#${id}-boot)`} stroke={OUTLINE} strokeWidth="3.5" strokeLinejoin="round">
      <path d="M-46 0 L-46 -20 Q-46 -30 -36 -30 L-24 -30 Q-17 -30 -17 -22 L-17 -14 Q-6 -14 -4 -6 L-4 0 Z" />
      <path d="M14 0 L14 -20 Q14 -30 24 -30 L36 -30 Q43 -30 43 -22 L43 -14 Q54 -14 56 -6 L56 0 Z" />
    </g>
    <path d="M-45 -24 L-18 -24 M15 -24 L42 -24" stroke={`url(#${id}-gold)`} strokeWidth="3.5" />
    <path d="M-46 -3 L-4 -3 M14 -3 L56 -3" stroke="#f6e3c8" strokeWidth="2.5" opacity="0.7" />

    {/* Rear arm (behind the body) */}
    <g data-part="rearArm">
      <path className={styles.armOutline} d={p.rearArm} />
      <path className={styles.armRear} d={p.rearArm} />
    </g>

    {/* Speed lines trail behind the body */}
    <g data-part="rearStreak"><Streak /></g>
    <g data-part="leadStreak"><Streak /></g>

    {/* Torso + head lean together around the hips */}
    <g data-part="upper">
      <path d="M-32 -150 C-44 -128 -42 -100 -32 -84 L36 -84 C46 -100 46 -128 36 -150 C20 -162 -16 -162 -32 -150 Z" fill={`url(#${id}-body)`} stroke={OUTLINE} strokeWidth="4" strokeLinejoin="round" />
      <ellipse cx="10" cy="-114" rx="21" ry="25" fill={`url(#${id}-belly)`} />
      <path d="M-20 -146 C-28 -132 -30 -116 -26 -100" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="4" strokeLinecap="round" />

      <g transform="translate(6 -160)">
        <g data-part="head">
          <g transform="translate(-6 160)">
            {/* Ears */}
            <path d="M-46 -214 L-74 -232 L-52 -190 Z" fill={`url(#${id}-body)`} stroke={OUTLINE} strokeWidth="3.5" strokeLinejoin="round" />
            <path d="M-51 -210 L-66 -222 L-54 -199 Z" fill="#7c0806" opacity="0.6" />
            {/* Horns */}
            <path d="M-36 -236 C-50 -256 -48 -278 -32 -292 C-34 -274 -24 -258 -12 -248 Z" fill={`url(#${id}-horn)`} stroke={OUTLINE} strokeWidth="3.5" strokeLinejoin="round" />
            <path d="M28 -248 C40 -258 48 -276 44 -294 C60 -278 64 -256 52 -234 Z" fill={`url(#${id}-horn)`} stroke={OUTLINE} strokeWidth="3.5" strokeLinejoin="round" />
            <path className={styles.hornGlow} d="M-32 -292 C-34 -282 -30 -272 -26 -266 M44 -294 C50 -284 50 -274 48 -266" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            {/* Skull */}
            <path d="M-50 -208 C-52 -240 -26 -258 6 -258 C40 -258 62 -238 60 -206 C59 -176 38 -156 6 -156 C-28 -156 -49 -176 -50 -208 Z" fill={`url(#${id}-skin)`} stroke={OUTLINE} strokeWidth="4" strokeLinejoin="round" />
            <path d="M-6 -257 C-4 -270 6 -274 8 -266 C12 -276 22 -272 18 -256" fill="#c71a12" stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round" />
            <ellipse cx="-20" cy="-238" rx="16" ry="8" fill="#fff" opacity="0.28" transform="rotate(-24 -20 -238)" />
            <ellipse cx="-32" cy="-184" rx="9" ry="5.5" fill="#ff8a8a" opacity="0.45" />

            {/* Face — slides toward the bag when fighting, faces you when talking */}
            <g className={styles.face}>
              <ellipse cx="48" cy="-184" rx="8" ry="5" fill="#ff8a8a" opacity="0.4" />
              <g className={styles.eyes}>
                <g transform="translate(-10 -204)">
                  <path d="M-13 -9 L12 -1 Q13 11 0 12 Q-14 11 -13 -9 Z" fill="#fff" stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round" />
                  <g className={styles.pupil}><circle cx="2" cy="4" r="5" fill="#1b0303" /><circle cx="3.6" cy="2.2" r="1.6" fill="#fff" /></g>
                </g>
                <g transform="translate(26 -204)">
                  <path d="M13 -9 L-12 -1 Q-13 11 0 12 Q14 11 13 -9 Z" fill="#fff" stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round" />
                  <g className={styles.pupil}><circle cx="-1" cy="4" r="5" fill="#1b0303" /><circle cx="0.6" cy="2.2" r="1.6" fill="#fff" /></g>
                </g>
              </g>
              <g data-part="brows">
                <g className={styles.brows} fill="#2a0505">
                  <path d="M-29 -224 Q-10 -220 4 -208 L1 -203 Q-13 -211 -28 -215 Z" />
                  <path d="M45 -224 Q26 -220 12 -208 L15 -203 Q29 -211 44 -215 Z" />
                </g>
              </g>
              <path d="M6 -190 q3 3 6 0" fill="none" stroke="#6d0705" strokeWidth="2.4" strokeLinecap="round" />
              {/* Mouths: gritted (fighting), open grin (talking), panting (catching breath) */}
              <g className={styles.mouthGrit}>
                <path d="M-8 -180 Q8 -183 24 -180 L24 -170 Q8 -167 -8 -170 Z" fill="#fff" stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round" />
                <path d="M-7 -175 L23 -175 M0 -181 L0 -169 M8 -182 L8 -168 M16 -181 L16 -169" stroke="#3a0505" strokeWidth="1.6" />
              </g>
              <g className={styles.mouthOpen}>
                <path d="M-12 -182 Q8 -178 28 -182 Q26 -158 8 -158 Q-10 -158 -12 -182 Z" fill="#3b0306" stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round" />
                <ellipse cx="8" cy="-163" rx="10" ry="5" fill="#ff5f6d" />
                <path d="M-10 -181 Q8 -177 26 -181 L25 -176 Q8 -173 -9 -176 Z" fill="#fff" />
                <path d="M-6 -177 L-3 -171 L0 -176.5 M16 -176.5 L19 -171 L22 -177" fill="#fff" />
              </g>
              <g className={styles.mouthPant}>
                <ellipse cx="9" cy="-172" rx="7" ry="8" fill="#3b0306" stroke={OUTLINE} strokeWidth="3" />
                <ellipse cx="9" cy="-168" rx="4" ry="2.5" fill="#ff5f6d" />
              </g>
            </g>
            {/* Sweat (catching breath) */}
            <g className={styles.sweat}>
              <path d="M-44 -236 q-8 12 0 16 q8 -4 0 -16 Z" fill="#bfe6ff" stroke={OUTLINE} strokeWidth="1.8" />
              <path d="M60 -226 q-7 11 0 15 q7 -4 0 -15 Z" fill="#bfe6ff" stroke={OUTLINE} strokeWidth="1.8" />
            </g>
          </g>
        </g>
      </g>
    </g>

    {/* Shorts */}
    <path d="M-38 -96 L42 -96 L50 -50 Q32 -43 14 -50 L6 -64 L-2 -50 Q-22 -43 -44 -50 Z" fill={`url(#${id}-shorts)`} stroke={OUTLINE} strokeWidth="4" strokeLinejoin="round" />
    <path d="M44 -88 L49 -54" stroke="#e8291c" strokeWidth="4" strokeLinecap="round" />
    <path d="M-34 -84 L-40 -54" stroke="#e8291c" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    <path d="M-22 -58 C-30 -62 -30 -72 -24 -80 C-24 -74 -21 -73 -20 -76 C-20 -82 -16 -86 -12 -88 C-14 -82 -10 -78 -10 -72 C-10 -64 -15 -58 -22 -58 Z" fill={`url(#${id}-gold)`} stroke={OUTLINE} strokeWidth="2" strokeLinejoin="round" />
    <rect x="-40" y="-104" width="84" height="13" rx="6" fill={`url(#${id}-gold)`} stroke={OUTLINE} strokeWidth="3.5" />
    <path d="M-34 -97.5 L38 -97.5" stroke="#a8470a" strokeWidth="1.4" strokeDasharray="3 3" />

    {/* Rear glove sits over the chest, the lead arm is closest to us */}
    <g data-part="rearGlove" transform={p.rearGlove}><Glove id={id} /></g>
    <g data-part="leadArm">
      <path className={styles.armOutline} d={p.leadArm} />
      <path className={styles.armLead} d={p.leadArm} />
    </g>
    <g data-part="leadGlove" transform={p.leadGlove}><Glove id={id} /></g>
  </g>;
}
