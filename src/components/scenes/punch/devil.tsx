import styles from "../punch.module.css";

/**
 * The little devil boxer, rendered as a soft 3D "designer vinyl toy": no outlines, form comes from
 * volumetric gradients, ambient occlusion where parts meet, glossy speculars on horns and gloves,
 * and a warm rim light from the fire below (an SVG filter on the whole silhouette).
 *
 * Drawn facing right in a local space whose origin is the point between its feet (y grows
 * downwards, so the body lives at negative y). Every moving part sits under its own pivot group
 * (data-part) so the engine can pose it with plain SVG transform attributes.
 */

export type Point = { x: number; y: number };

export const HIP: Point = { x: 2, y: -86 };
export const SHOULDER = { lead: { x: 22, y: -140 }, rear: { x: -12, y: -142 } };
export const GUARD = {
  fight: { lead: { x: 72, y: -162 }, rear: { x: 46, y: -136 } },
  speak: { lead: { x: 78, y: -166 }, rear: { x: -54, y: -160 } },
  think: { lead: { x: 58, y: -100 }, rear: { x: 30, y: -96 } },
};

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

/* ───────── Shapes reused for fills and clip paths ───────── */
const HEAD = "M-50 -206 C-51 -241 -24 -261 6 -261 C40 -261 63 -239 61 -205 C60 -173 38 -153 6 -153 C-28 -153 -50 -173 -50 -206 Z";
const TORSO = "M-30 -152 C-46 -134 -46 -102 -35 -86 C-12 -78 18 -78 39 -86 C50 -102 50 -134 34 -152 C18 -164 -14 -164 -30 -152 Z";
const SHORTS = "M-39 -98 C-12 -101 18 -101 43 -98 C47 -84 50 -66 51 -52 C40 -45 26 -45 15 -50 L7 -63 L-1 -50 C-12 -45 -32 -45 -45 -52 C-44 -68 -42 -86 -39 -98 Z";
const EYE = "M-14 -8 C-6 -6.5 4 -3.5 12.5 -0.5 C13.5 7 8.5 13 0 13 C-9 13 -15.5 6 -14 -8 Z";
const GLOVE = "M-28 -20 C-18 -33 14 -35 27 -21 C37 -10 37 11 27 21 C16 32 -14 32 -27 20 C-33 11 -33 -11 -28 -20 Z";
const TAIL = "M0 0 C-36 8 -64 -4 -62 -36 S-42 -78 -66 -98";
const BACK_LEG = "M-16 -62 Q-26 -40 -30 -22";
const FRONT_LEG = "M20 -62 Q28 -40 30 -22";
const BOOT = "M-47 -3 C-48 -15 -47 -27 -38 -31.5 C-32 -34 -24 -34 -19 -29.5 C-16 -26 -16 -20 -15.5 -16 C-7 -15 -3 -10.5 -3 -4.5 C-3 -1.5 -5 0 -8 0 L-44 0 C-46 0 -47 -1.5 -47 -3 Z";

type Stops = [number, string, number?][];
const stops = (list: Stops) => list.map(([o, c, a = 1], i) => <stop key={i} offset={o} stopColor={c} stopOpacity={a} />);

/** A soft round blob of colour fading to nothing: the cheap way to paint light, shade and glow. */
function Soft({ id, color, alpha }: { id: string; color: string; alpha: number }) {
  return <radialGradient id={id}>{stops([[0, color, alpha], [0.45, color, alpha * 0.62], [1, color, 0]])}</radialGradient>;
}

export function DevilDefs({ id }: { id: string }) {
  return <>
    {/* Skin: glossy red vinyl lit from the upper left, with warm subsurface in the mid-tones. */}
    <radialGradient id={`${id}-skinHead`} cx="0.4" cy="0.32" r="0.74" fx="0.33" fy="0.22">
      {stops([[0, "#ffb391"], [0.16, "#ff6a48"], [0.42, "#e2321f"], [0.72, "#a8160d"], [1, "#4e0606"]])}
    </radialGradient>
    <radialGradient id={`${id}-skinBody`} cx="0.36" cy="0.26" r="0.86" fx="0.3" fy="0.18">
      {stops([[0, "#ff9272"], [0.22, "#f04a2f"], [0.55, "#c4220f"], [0.85, "#7c0c08"], [1, "#420404"]])}
    </radialGradient>
    <radialGradient id={`${id}-spade`} cx="0.4" cy="0.35" r="0.75" fx="0.32" fy="0.25">
      {stops([[0, "#ff8a66"], [0.35, "#e0301d"], [0.8, "#8c0f0a"], [1, "#4a0505"]])}
    </radialGradient>
    <radialGradient id={`${id}-earInner`} cx="0.55" cy="0.7" r="0.75">
      {stops([[0, "#ffc08a"], [0.4, "#ff7a52"], [1, "#b8261a"]])}
    </radialGradient>
    <linearGradient id={`${id}-horn`} x1="0.1" y1="1" x2="0.35" y2="0">
      {stops([[0, "#3a1408"], [0.18, "#7e4a26"], [0.5, "#d9ad74"], [0.8, "#f6dfb4"], [1, "#fff6e2"]])}
    </linearGradient>
    <linearGradient id={`${id}-hornShade`} x1="0" y1="0" x2="1" y2="0">
      {stops([[0, "#2a0a04", 0], [0.55, "#2a0a04", 0], [1, "#2a0a04", 0.55]])}
    </linearGradient>
    {/* Eyes */}
    <radialGradient id={`${id}-sclera`} cx="0.45" cy="0.55" r="0.65">
      {stops([[0, "#fffaf3"], [0.6, "#f6e7dc"], [1, "#c9a79a"]])}
    </radialGradient>
    <radialGradient id={`${id}-iris`} cx="0.5" cy="0.5" r="0.5" fx="0.42" fy="0.62">
      {stops([[0, "#fff1a8"], [0.3, "#ffc23a"], [0.7, "#f06414"], [1, "#6a1804"]])}
    </radialGradient>
    <linearGradient id={`${id}-brow`} x1="0" y1="0" x2="0" y2="1">
      {stops([[0, "#6e1410"], [0.5, "#3a0707"], [1, "#1e0303"]])}
    </linearGradient>
    {/* Mouth */}
    <linearGradient id={`${id}-tooth`} x1="0" y1="0" x2="0" y2="1">
      {stops([[0, "#fbf3e6"], [0.55, "#ecdcc6"], [1, "#b39478"]])}
    </linearGradient>
    <radialGradient id={`${id}-mouth`} cx="0.5" cy="0.3" r="0.8">
      {stops([[0, "#6a0a14"], [0.6, "#2e0207"], [1, "#160103"]])}
    </radialGradient>
    <radialGradient id={`${id}-tongue`} cx="0.45" cy="0.35" r="0.7">
      {stops([[0, "#ff9aa0"], [0.5, "#f0505e"], [1, "#9a1c2c"]])}
    </radialGradient>
    {/* Gloves: glossy amber leather with a cream cuff. */}
    <radialGradient id={`${id}-glove`} cx="0.58" cy="0.3" r="0.82" fx="0.62" fy="0.22">
      {stops([[0, "#fff4cc"], [0.14, "#ffd65e"], [0.42, "#f6a420"], [0.74, "#c4620a"], [1, "#5e2603"]])}
    </radialGradient>
    <radialGradient id={`${id}-thumb`} cx="0.5" cy="0.3" r="0.8">
      {stops([[0, "#fff0b0"], [0.35, "#ffc844"], [1, "#c86c0c"]])}
    </radialGradient>
    <linearGradient id={`${id}-cuff`} x1="0" y1="0" x2="0" y2="1">
      {stops([[0, "#fffaf0"], [0.32, "#f3e5d0"], [0.72, "#c7ab8a"], [1, "#6e5038"]])}
    </linearGradient>
    <linearGradient id={`${id}-cuffBand`} x1="0" y1="0" x2="0" y2="1">
      {stops([[0, "#ff7a5c"], [0.35, "#d8261a"], [1, "#5e0606"]])}
    </linearGradient>
    <linearGradient id={`${id}-smear`} x1="1" y1="0" x2="0" y2="0">
      {stops([[0, "#ffe2a0", 0.6], [0.4, "#ffb04a", 0.25], [1, "#ff7a2a", 0]])}
    </linearGradient>
    {/* Satin shorts, brushed-gold trim, satin boots */}
    <linearGradient id={`${id}-shorts`} x1="0" y1="0" x2="1" y2="0">
      {stops([[0, "#12040a"], [0.18, "#3e1324"], [0.34, "#8a2c4a"], [0.46, "#4a1528"], [0.7, "#2a0a16"], [0.84, "#5a1a30"], [1, "#12040a"]])}
    </linearGradient>
    <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
      {stops([[0, "#fff3c0"], [0.3, "#f5c64c"], [0.62, "#c07c12"], [1, "#6a3a06"]])}
    </linearGradient>
    <radialGradient id={`${id}-boot`} cx="0.35" cy="0.25" r="0.9">
      {stops([[0, "#a8384a"], [0.3, "#5a1424"], [0.75, "#200610"], [1, "#0a0205"]])}
    </radialGradient>
    <linearGradient id={`${id}-sole`} x1="0" y1="0" x2="0" y2="1">
      {stops([[0, "#e9d8c2"], [0.5, "#b8a088"], [1, "#5e4a3a"]])}
    </linearGradient>
    <linearGradient id={`${id}-drop`} x1="0" y1="0" x2="1" y2="1">
      {stops([[0, "#ffffff", 0.95], [0.5, "#bfe6ff", 0.75], [1, "#5aa0d8", 0.85]])}
    </linearGradient>

    {/* Soft light, shade and glow blobs */}
    <Soft id={`${id}-shade`} color="#2a0102" alpha={0.75} />
    <Soft id={`${id}-ao`} color="#120000" alpha={0.85} />
    <Soft id={`${id}-light`} color="#fff3e4" alpha={0.7} />
    <Soft id={`${id}-spec`} color="#ffffff" alpha={0.95} />
    <Soft id={`${id}-warm`} color="#ff8a5c" alpha={0.55} />
    <Soft id={`${id}-fire`} color="#ffb55a" alpha={0.85} />
    <Soft id={`${id}-blush`} color="#ff6f62" alpha={0.6} />

    <clipPath id={`${id}-headClip`}><path d={HEAD} /></clipPath>
    <clipPath id={`${id}-torsoClip`}><path d={TORSO} /></clipPath>
    <clipPath id={`${id}-shortsClip`}><path d={SHORTS} /></clipPath>
    <clipPath id={`${id}-gloveClip`}><path d={GLOVE} /></clipPath>
    <clipPath id={`${id}-eyeClip`}><path d={EYE} /></clipPath>
    <clipPath id={`${id}-eyeClipR`}><path d={EYE} transform="scale(-1 1)" /></clipPath>

    {/*
      Rim light from the fire: the inner edge of the silhouette that faces down (strongest) and
      sideways picks up a warm glow, screened over the figure.
    */}
    <filter id={`${id}-rim`} x="-15%" y="-10%" width="130%" height="120%" colorInterpolationFilters="sRGB">
      <feOffset in="SourceAlpha" dy="-3.5" result="up" />
      <feComposite in="SourceAlpha" in2="up" operator="out" result="bottomEdge" />
      <feOffset in="SourceAlpha" dx="3" result="right" />
      <feComposite in="SourceAlpha" in2="right" operator="out" result="leftEdge" />
      <feOffset in="SourceAlpha" dx="-3" result="left" />
      <feComposite in="SourceAlpha" in2="left" operator="out" result="rightEdge" />
      <feComponentTransfer in="leftEdge" result="leftSoft"><feFuncA type="linear" slope="0.22" /></feComponentTransfer>
      <feComponentTransfer in="rightEdge" result="rightSoft"><feFuncA type="linear" slope="0.3" /></feComponentTransfer>
      <feComponentTransfer in="bottomEdge" result="bottomSoft"><feFuncA type="linear" slope="0.6" /></feComponentTransfer>
      <feMerge result="edges"><feMergeNode in="leftSoft" /><feMergeNode in="rightSoft" /><feMergeNode in="bottomSoft" /></feMerge>
      <feGaussianBlur in="edges" stdDeviation="1.4" result="blurred" />
      <feComposite in="blurred" in2="SourceAlpha" operator="in" result="inside" />
      <feFlood floodColor="#ffb468" result="color" />
      <feComposite in="color" in2="inside" operator="in" result="rim" />
      <feBlend in="rim" in2="SourceGraphic" mode="screen" />
    </filter>
  </>;
}

function Glove({ id }: { id: string }) {
  return <g className={styles.gloveArt}>
    {/* Cuff */}
    <path d="M-46 -15 C-48.5 -5 -48.5 5 -46 15 C-40 18.5 -30 19.5 -22 18.5 L-22 -18.5 C-30 -19.5 -40 -18.5 -46 -15 Z" fill={`url(#${id}-cuff)`} />
    <path d="M-39.5 -18.6 L-33 -18.9 L-33 18.9 L-39.5 18.6 C-41 6 -41 -6 -39.5 -18.6 Z" fill={`url(#${id}-cuffBand)`} />
    <ellipse cx="-34" cy="-10" rx="10" ry="3" fill={`url(#${id}-light)`} />
    {/* Mitt */}
    <path d={GLOVE} fill={`url(#${id}-glove)`} />
    <g clipPath={`url(#${id}-gloveClip)`}>
      <ellipse cx="-30" cy="0" rx="11" ry="26" fill={`url(#${id}-ao)`} opacity="0.55" />
      <ellipse cx="2" cy="30" rx="34" ry="10" fill={`url(#${id}-fire)`} opacity="0.8" />
      <ellipse cx="34" cy="4" rx="8" ry="22" fill={`url(#${id}-shade)`} opacity="0.5" />
    </g>
    {/* Thumb, with a soft crease where it folds over the fist */}
    <path d="M-20 -12 C-12 -7 -1 -8 5 -16" fill="none" stroke="#7a3604" strokeOpacity="0.4" strokeWidth="3.4" strokeLinecap="round" />
    <path d="M-22 -18 C-16 -30 0 -30 5 -19.5 C1 -11 -14 -10 -22 -18 Z" fill={`url(#${id}-thumb)`} />
    <ellipse cx="-8" cy="-23" rx="8" ry="2.8" fill={`url(#${id}-spec)`} opacity="0.6" transform="rotate(-6 -8 -23)" />
    <path d="M-15 8 C-4 12.5 10 12.5 21 6.5" fill="none" stroke="#7a3604" strokeOpacity="0.32" strokeWidth="2.2" strokeLinecap="round" />
    {/* Gloss */}
    <ellipse cx="11" cy="-15" rx="17" ry="8" fill={`url(#${id}-light)`} transform="rotate(10 11 -15)" />
    <ellipse cx="14" cy="-18" rx="8" ry="2.8" fill={`url(#${id}-spec)`} transform="rotate(14 14 -18)" />
    <circle cx="28" cy="-5" r="2" fill="#fff" opacity="0.75" />
  </g>;
}

/** A soft motion smear trailing the glove while it snaps out. */
function Streak({ id }: { id: string }) {
  return <g opacity="0">
    <path d="M-34 -19 C-70 -16 -112 -7 -148 0 C-112 7 -70 16 -34 19 Z" fill={`url(#${id}-smear)`} />
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

/** One sculpted brow ridge (the left one; the right is its mirror). */
function Brow({ id }: { id: string }) {
  return <>
    <ellipse cx="-11" cy="-210" rx="18" ry="6" fill={`url(#${id}-ao)`} opacity="0.5" transform="rotate(24 -11 -210)" />
    <path d="M-31 -222 C-20 -225 -6 -219.5 4.5 -209 C5.5 -206 3 -202.5 0 -204 C-10 -211 -20 -214 -29 -214.5 C-33.5 -215 -34.5 -220 -31 -222 Z" fill={`url(#${id}-brow)`} />
    <path d="M-29 -220.5 C-19 -222 -8 -217.5 1 -209.5" fill="none" stroke="#ff8a66" strokeOpacity="0.38" strokeWidth="1.4" strokeLinecap="round" />
  </>;
}

/** One angry eye. The right eye mirrors the socket and lid, but its pupil still looks toward the bag. */
function Eye({ id, flip = false }: { id: string; flip?: boolean }) {
  const mirror = flip ? "scale(-1 1)" : undefined;
  return <>
    <g transform={mirror}>
      <ellipse cx="0" cy="3" rx="19" ry="16" fill={`url(#${id}-shade)`} opacity="0.55" />
      <path d={EYE} fill={`url(#${id}-sclera)`} />
    </g>
    <g clipPath={`url(#${id}-eyeClip${flip ? "R" : ""})`}>
      <g className={styles.pupil}>
        <circle cx={flip ? -1 : 2} cy="4.5" r="7" fill={`url(#${id}-iris)`} />
        <ellipse cx={flip ? -0.6 : 2.4} cy="4.8" rx="2.1" ry="4.4" fill="#1a0202" />
        <circle cx={flip ? 1.8 : 4.8} cy="1.6" r="2" fill="#fff" />
        <circle cx={flip ? -3.6 : -0.6} cy="8" r="0.9" fill="#fff" opacity="0.7" />
      </g>
      {/* The heavy upper lid casts a shadow across the top of the eye. */}
      <path transform={mirror} d="M-16 -10 C-6 -8.5 4 -5.5 14 -2.5 L14 4 C4 0.5 -6 -2.5 -16 -3 Z" fill="#4a0606" opacity="0.32" />
    </g>
  </>;
}

export function Devil({ id, pose = "fight" }: { id: string; pose?: keyof typeof GUARD }) {
  const p = guardPose(pose);
  return <g className={styles.devil}>
    <g filter={`url(#${id}-rim)`}>
      {/* Tail */}
      <g transform="translate(-30 -76)">
        <g data-part="tail" className={styles.tail}>
          <path d={TAIL} fill="none" stroke="#3a0404" strokeOpacity="0.45" strokeWidth="10" strokeLinecap="round" transform="translate(1.5 2.5)" />
          <path d={TAIL} fill="none" stroke="#a8160e" strokeWidth="8.5" strokeLinecap="round" />
          <path d={TAIL} fill="none" stroke="#ff7a58" strokeOpacity="0.5" strokeWidth="2.6" strokeLinecap="round" transform="translate(-1.2 -1.6)" />
          <g transform="translate(-68 -100) rotate(-28)">
            <path d="M0 -29 C7 -16 21 -10 17 2 C13 10 4 9 0 3.5 C-4 9 -13 10 -17 2 C-21 -10 -7 -16 0 -29 Z" fill={`url(#${id}-spade)`} />
            <ellipse cx="-6" cy="-6" rx="5" ry="8" fill={`url(#${id}-light)`} opacity="0.85" transform="rotate(20 -6 -6)" />
            <ellipse cx="0" cy="5" rx="9" ry="4" fill={`url(#${id}-shade)`} opacity="0.6" />
          </g>
        </g>
      </g>

      {/* Legs */}
      <path d={BACK_LEG} fill="none" stroke="#7c0e09" strokeWidth="20" strokeLinecap="round" />
      <path d={BACK_LEG} fill="none" stroke="#e05638" strokeOpacity="0.35" strokeWidth="5" strokeLinecap="round" transform="translate(-3.5 0)" />
      <path d={FRONT_LEG} fill="none" stroke="#c4220f" strokeWidth="20" strokeLinecap="round" />
      <path d={FRONT_LEG} fill="none" stroke="#5a0606" strokeOpacity="0.45" strokeWidth="6" strokeLinecap="round" transform="translate(4 0)" />
      <path d={FRONT_LEG} fill="none" stroke="#ff8a66" strokeOpacity="0.5" strokeWidth="4.5" strokeLinecap="round" transform="translate(-3.5 0)" />
      {/* Shorts cast a shadow down the thighs */}
      <ellipse cx="2" cy="-58" rx="44" ry="11" fill={`url(#${id}-ao)`} opacity="0.75" />

      {/* Boots */}
      {[0, 60].map((dx) => <g key={dx} transform={`translate(${dx} 0)`}>
        <path d={BOOT} fill={`url(#${id}-boot)`} />
        <rect x="-46.5" y="-26.5" width="30" height="4.4" rx="2.2" fill={`url(#${id}-gold)`} />
        <ellipse cx="-36" cy="-21" rx="8" ry="6" fill={`url(#${id}-light)`} opacity="0.55" />
        <ellipse cx="-12" cy="-10" rx="7" ry="3.2" fill={`url(#${id}-spec)`} opacity="0.4" />
        <rect x="-47" y="-4.2" width="44" height="4.2" rx="2.1" fill={`url(#${id}-sole)`} />
      </g>)}

      {/* Rear arm (behind the body) */}
      <g data-part="rearArm">
        <path className={styles.armShade} d={p.rearArm} />
        <path className={styles.armRear} d={p.rearArm} />
        <path className={`${styles.armHi} ${styles.armHiRear}`} d={p.rearArm} />
      </g>

      {/* Motion smears trail behind the body */}
      <g data-part="rearStreak"><Streak id={id} /></g>
      <g data-part="leadStreak"><Streak id={id} /></g>

      {/* Torso + head lean together around the hips */}
      <g data-part="upper">
        <path d={TORSO} fill={`url(#${id}-skinBody)`} />
        <g clipPath={`url(#${id}-torsoClip)`}>
          <ellipse cx="10" cy="-114" rx="28" ry="30" fill={`url(#${id}-warm)`} />
          <ellipse cx="50" cy="-116" rx="16" ry="44" fill={`url(#${id}-shade)`} opacity="0.6" />
          <ellipse cx="-24" cy="-138" rx="12" ry="20" fill={`url(#${id}-light)`} opacity="0.55" transform="rotate(14 -24 -138)" />
          <ellipse cx="6" cy="-158" rx="46" ry="15" fill={`url(#${id}-ao)`} opacity="0.95" />
          <ellipse cx="4" cy="-86" rx="46" ry="9" fill={`url(#${id}-ao)`} opacity="0.7" />
        </g>

        <g transform="translate(6 -160)">
          <g data-part="head">
            <g transform="translate(-6 160)">
              {/* Ear (the far one is hidden behind the head) */}
              <path d="M-44 -213 C-58 -222 -72 -231 -81 -236 C-75 -221 -67 -199 -50 -187 Z" fill={`url(#${id}-skinBody)`} />
              <path d="M-48 -208 C-58 -215 -67 -222 -73 -226 C-68 -215 -61 -203 -51 -195 Z" fill={`url(#${id}-earInner)`} />
              <ellipse cx="-49" cy="-200" rx="8" ry="12" fill={`url(#${id}-ao)`} opacity="0.6" />

              {/* Horns */}
              <path d="M-40 -232 C-56 -252 -54 -281 -34 -297 C-36 -277 -26 -261 -10 -249 C-18 -239 -30 -233 -40 -232 Z" fill={`url(#${id}-horn)`} />
              <path d="M26 -250 C40 -260 48 -281 44 -299 C62 -281 66 -256 54 -232 C46 -238 34 -246 26 -250 Z" fill={`url(#${id}-horn)`} />
              <path d="M26 -250 C40 -260 48 -281 44 -299 C62 -281 66 -256 54 -232 C46 -238 34 -246 26 -250 Z" fill={`url(#${id}-hornShade)`} />
              <g fill="none" stroke="#5a2a10" strokeOpacity="0.35" strokeWidth="1.3" strokeLinecap="round">
                <path d="M-44 -258 C-38 -256 -32 -254 -27 -256" /><path d="M-43 -270 C-39 -268 -35 -267 -32 -269" />
                <path d="M44 -260 C50 -258 56 -258 60 -261" /><path d="M46 -272 C50 -270 54 -270 57 -272" />
              </g>
              <path className={styles.hornGlow} d="M-38 -286 C-44 -276 -44 -264 -38 -252 M48 -290 C55 -280 57 -268 55 -256" fill="none" stroke="#fffaf0" strokeWidth="2.6" strokeLinecap="round" />

              {/* Little flame-curl tuft */}
              <path d="M-8 -254 C-10 -270 0 -281 10 -277 C4 -273 4 -267 8 -263 C12 -273 22 -276 27 -270 C20 -266 20 -259 20 -252 Z" fill={`url(#${id}-skinBody)`} />

              {/* Skull */}
              <path d={HEAD} fill={`url(#${id}-skinHead)`} />
              <g clipPath={`url(#${id}-headClip)`}>
                <ellipse cx="10" cy="-180" rx="50" ry="22" fill={`url(#${id}-warm)`} opacity="0.85" />
                <ellipse cx="62" cy="-178" rx="34" ry="52" fill={`url(#${id}-shade)`} opacity="0.75" />
                <ellipse cx="6" cy="-150" rx="62" ry="16" fill={`url(#${id}-ao)`} opacity="0.75" />
                <ellipse cx="-27" cy="-250" rx="11" ry="5" fill={`url(#${id}-ao)`} opacity="0.3" />
                <ellipse cx="40" cy="-254" rx="11" ry="5" fill={`url(#${id}-ao)`} opacity="0.3" />
                <ellipse cx="-14" cy="-234" rx="30" ry="15" fill={`url(#${id}-light)`} transform="rotate(-22 -14 -234)" />
                <ellipse cx="-20" cy="-240" rx="11" ry="4.5" fill={`url(#${id}-spec)`} transform="rotate(-28 -20 -240)" />
              </g>
              <ellipse cx="-32" cy="-183" rx="11" ry="7" fill={`url(#${id}-blush)`} />

              {/* Face: slides toward the bag when fighting, faces you when talking */}
              <g className={styles.face}>
                <ellipse cx="47" cy="-183" rx="9" ry="6" fill={`url(#${id}-blush)`} />
                <g className={styles.eyes}>
                  {/* The blink lives on an inner group: CSS scale on a group would replace its translate. */}
                  <g transform="translate(-10 -204)"><g className={styles.blink}><Eye id={id} /></g></g>
                  <g transform="translate(26 -204)"><g className={styles.blink}><Eye id={id} flip /></g></g>
                </g>
                <g data-part="brows">
                  <g className={styles.brows}>
                    <Brow id={id} />
                    <g transform="translate(16 0) scale(-1 1)"><Brow id={id} /></g>
                  </g>
                </g>
                {/* Snout */}
                <ellipse cx="9" cy="-186" rx="9" ry="4" fill={`url(#${id}-shade)`} opacity="0.45" />
                <ellipse cx="8" cy="-191" rx="8" ry="4.5" fill={`url(#${id}-light)`} opacity="0.55" />
                <ellipse cx="5.5" cy="-189" rx="1.5" ry="1.1" fill="#4a0505" opacity="0.6" />
                <ellipse cx="11.5" cy="-189" rx="1.5" ry="1.1" fill="#4a0505" opacity="0.6" />

                {/* Mouths: gritted (fighting), open (talking), panting (catching breath) */}
                <g className={styles.mouthGrit}>
                  <ellipse cx="8" cy="-165" rx="17" ry="4" fill={`url(#${id}-shade)`} opacity="0.6" />
                  <path d="M-9.5 -181 C1 -184.5 15 -184.5 25.5 -181 C26.5 -176 25.5 -171 24.5 -168.5 C14 -165.5 0 -165.5 -8.5 -168.5 C-10.5 -172 -10.5 -177 -9.5 -181 Z" fill={`url(#${id}-mouth)`} />
                  {[-7, 0.6, 8.2, 15.8].map((x, i) => <rect key={`u${i}`} x={x} y={-182.3 + Math.abs(i - 1.5) * 0.6} width="7" height="7" rx="1.8" fill={`url(#${id}-tooth)`} />)}
                  {[-5.2, 2.4, 10, 17.4].map((x, i) => <rect key={`l${i}`} x={x} y="-174.8" width="6.8" height={6 - Math.abs(i - 1.5) * 0.5} rx="1.8" fill={`url(#${id}-tooth)`} />)}
                  <rect x="-8" y="-175.6" width="33" height="1.2" fill="#3a0306" opacity="0.55" />
                  <ellipse cx="6" cy="-180" rx="10" ry="1.6" fill="#fff" opacity="0.5" />
                </g>
                <g className={styles.mouthOpen}>
                  <path d="M-12 -182 Q8 -178 28 -182 Q26 -157 8 -157 Q-10 -157 -12 -182 Z" fill={`url(#${id}-mouth)`} />
                  <ellipse cx="8" cy="-163" rx="10.5" ry="5.5" fill={`url(#${id}-tongue)`} />
                  <path d="M-10 -181 Q8 -177 26 -181 L25 -175.5 Q8 -172.5 -9 -175.5 Z" fill={`url(#${id}-tooth)`} />
                  <path d="M-6 -177 L-3 -170.5 L0 -176.4 Z M16 -176.4 L19 -170.5 L22 -177 Z" fill={`url(#${id}-tooth)`} />
                </g>
                <g className={styles.mouthPant}>
                  <ellipse cx="9" cy="-172" rx="7" ry="8" fill={`url(#${id}-mouth)`} />
                  <ellipse cx="9" cy="-167.5" rx="4.2" ry="2.6" fill={`url(#${id}-tongue)`} />
                </g>
              </g>
              {/* Sweat (catching breath) */}
              <g className={styles.sweat}>
                <path d="M-44 -236 q-8 12 0 16 q8 -4 0 -16 Z" fill={`url(#${id}-drop)`} />
                <path d="M60 -226 q-7 11 0 15 q7 -4 0 -15 Z" fill={`url(#${id}-drop)`} />
              </g>
            </g>
          </g>
        </g>
      </g>

      {/* Shorts */}
      <path d={SHORTS} fill={`url(#${id}-shorts)`} />
      <g clipPath={`url(#${id}-shortsClip)`}>
        <ellipse cx="7" cy="-58" rx="10" ry="12" fill={`url(#${id}-ao)`} opacity="0.9" />
        <ellipse cx="2" cy="-44" rx="60" ry="9" fill={`url(#${id}-fire)`} opacity="0.35" />
        <ellipse cx="-24" cy="-72" rx="8" ry="20" fill={`url(#${id}-light)`} opacity="0.35" />
        <ellipse cx="32" cy="-70" rx="7" ry="16" fill={`url(#${id}-light)`} opacity="0.2" />
        <ellipse cx="2" cy="-96" rx="50" ry="8" fill={`url(#${id}-ao)`} opacity="0.6" />
        <path d="M44 -92 L49.5 -54" stroke="#d8261a" strokeWidth="4" strokeLinecap="round" />
      </g>
      {/* Flame emblem */}
      <path d="M-22 -58 C-30 -62 -30 -72 -24 -80 C-24 -74 -21 -73 -20 -76 C-20 -82 -16 -86 -12 -88 C-14 -82 -10 -78 -10 -72 C-10 -64 -15 -58 -22 -58 Z" fill={`url(#${id}-gold)`} />
      <ellipse cx="-19" cy="-73" rx="2.5" ry="5" fill={`url(#${id}-spec)`} opacity="0.6" />
      {/* Waistband */}
      <ellipse cx="2" cy="-91" rx="42" ry="6" fill={`url(#${id}-ao)`} opacity="0.6" />
      <rect x="-40" y="-104" width="84" height="13" rx="6.5" fill={`url(#${id}-gold)`} />
      <rect x="-34" y="-102.6" width="60" height="3" rx="1.5" fill="#fff8dc" opacity="0.5" />

      {/* Rear glove sits over the chest, the lead arm is closest to us */}
      <g data-part="rearGlove" transform={p.rearGlove}><Glove id={id} /></g>
      <g data-part="leadArm">
        <path className={styles.armAo} d={p.leadArm} />
        <path className={styles.armShade} d={p.leadArm} />
        <path className={styles.armLead} d={p.leadArm} />
        <path className={styles.armHi} d={p.leadArm} />
      </g>
      <g data-part="leadGlove" transform={p.leadGlove}><Glove id={id} /></g>
    </g>
  </g>;
}
