import { BAR_Y, FLOOR, frame, type Pose } from "./rig";

const INK = "#101014";
const HOT = "var(--sw-hot, #ff3d8b)";
const LIME = "var(--sw-lime, #c6f432)";

/** Static attributes for one rig part, so the first paint matches what the engine will write each frame. */
function part(attrs: Record<string, Record<string, string | number>>, key: string) {
  return { "data-k": key, ...attrs[key] };
}

/**
 * Bolt, the gym buddy: a cobalt ball of grit with a pink sweatband, wristbands and fresh kicks.
 * Everything that moves carries data-k so the engine can write the next frame directly.
 */
export function Figure({ pose, uid, drops = 0, className, viewBox = "0 0 320 420", align = "xMidYMax meet" }: { pose: Pose; uid: string; drops?: number; className?: string; viewBox?: string; align?: string }) {
  const f = frame(pose);
  const id = (name: string) => `sw-${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  const arm = (side: "L" | "R") => <>
    <path {...part(f, `arm${side}`)} stroke={INK} strokeWidth={23} />
    <g {...part(f, `bulge${side}`)}><circle r={13} fill={INK} /></g>
  </>;
  const armFill = (side: "L" | "R") => <>
    <path {...part(f, `arm${side}`)} stroke={url("limb")} strokeWidth={16} />
    <g {...part(f, `bulge${side}`)}><circle r={9.5} fill={url("limb")} /><path d="M-5 -4 Q 0 -8 5 -4" stroke="#8fb0ff" strokeWidth={2.2} opacity={0.8} /></g>
    <path {...part(f, `band${side}`)} stroke={INK} strokeWidth={26} />
    <path {...part(f, `band${side}`)} stroke={HOT} strokeWidth={20} />
    <path {...part(f, `stripe${side}`)} stroke="#fff" strokeWidth={20} />
  </>;
  const leg = (side: "L" | "R") => <>
    <path {...part(f, `leg${side}`)} stroke={INK} strokeWidth={20} />
    <path {...part(f, `leg${side}`)} stroke={url("limb")} strokeWidth={13.5} />
    <path {...part(f, `sock${side}`)} stroke="#fff" strokeWidth={13.5} />
    <g {...part(f, `shoe${side}`)}>
      <path d="M-11 9 L-11 -3 Q-10 -10 -2 -9 L5 -6 Q18 -3 22 4 L22 9 Q22 12 18 12 L-8 12 Q-11 12 -11 9Z" fill="#fff" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d="M-10 8 L21.5 8" stroke={INK} strokeWidth={2.5} />
      <path d="M-9 9.5 H20" stroke={LIME} strokeWidth={2.4} />
      <path d="M-4 3 Q6 4 13 -2" stroke={HOT} strokeWidth={3.6} />
      <path d="M-2 -6 L1 -2 M3 -5 L6 -1" stroke={INK} strokeWidth={1.6} />
    </g>
  </>;
  const fist = (side: "L" | "R") => <g {...part(f, `hand${side}`)}>
    <rect x={-13} y={-12} width={26} height={22} rx={10} fill={url("limb")} stroke={INK} strokeWidth={3.2} />
    <path d="M-5.5 -11 V-4 M0.5 -11.5 V-3.5 M6.5 -11 V-4" stroke={INK} strokeWidth={2} />
    <ellipse cx={-11} cy={2} rx={5} ry={6.5} fill={url("limb")} stroke={INK} strokeWidth={2.8} />
    <path d="M-6 -9 Q-3 -11 0 -9.5" stroke="#9db9ff" strokeWidth={1.8} opacity={0.9} />
  </g>;

  return <svg className={className} viewBox={viewBox} preserveAspectRatio={align} overflow={drops ? "visible" : "hidden"} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <defs>
      <radialGradient id={id("body")} cx="0.36" cy="0.3" r="0.78">
        <stop offset="0" stopColor="#6f9bff" />
        <stop offset="0.42" stopColor="#2f5bff" />
        <stop offset="0.82" stopColor="#1c36c9" />
        <stop offset="1" stopColor="#13238c" />
      </radialGradient>
      <linearGradient id={id("limb")} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#4a74ff" />
        <stop offset="1" stopColor="#2140d6" />
      </linearGradient>
      <linearGradient id={id("steel")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f4f6f1" />
        <stop offset="0.45" stopColor="#b9bdb4" />
        <stop offset="1" stopColor="#5d6159" />
      </linearGradient>
      <pattern id={id("knurl")} width="6" height="12" patternUnits="userSpaceOnUse" patternTransform="skewX(-30)">
        <rect width="6" height="12" fill={INK} />
        <rect width="2.4" height="12" fill={LIME} />
      </pattern>
      <radialGradient id={id("shadow")}>
        <stop offset="0" stopColor={INK} stopOpacity="1" />
        <stop offset="1" stopColor={INK} stopOpacity="0" />
      </radialGradient>
      <clipPath id={id("clip")}><ellipse rx={64} ry={64} /></clipPath>
    </defs>

    <ellipse {...part(f, "shadow")} rx={66} ry={9} fill={url("shadow")} />

    {/* The bar runs wall to wall: the phone is the doorway. */}
    <g>
      <rect x={-700} y={BAR_Y - 6.5} width={1720} height={13} rx={6.5} fill={url("steel")} stroke={INK} strokeWidth={3} />
      <rect x={58} y={BAR_Y - 6.5} width={44} height={13} fill={url("knurl")} stroke={INK} strokeWidth={2.5} />
      <rect x={218} y={BAR_Y - 6.5} width={44} height={13} fill={url("knurl")} stroke={INK} strokeWidth={2.5} />
      <path d={`M-700 ${BAR_Y - 2.5} H1020`} stroke="#fff" strokeWidth={2} opacity={0.7} />
    </g>

    {arm("L")}{arm("R")}
    {armFill("L")}{armFill("R")}
    {leg("L")}{leg("R")}

    <g {...part(f, "body")}>
      <ellipse rx={64} ry={64} fill={url("body")} />
      <g clipPath={url("clip")}>
        <path d="M-70 -44 Q0 -62 70 -44 L70 -27 Q0 -45 -70 -27Z" fill={HOT} stroke={INK} strokeWidth={3} />
        <path d="M-70 -36 Q0 -54 70 -36" stroke="#fff" strokeWidth={3.2} />
        <rect x={-70} y={36} width={140} height={40} fill={INK} />
        <rect x={-70} y={36} width={140} height={5} fill={LIME} />
        <path d="M-52 44 L-60 66 M-45 44 L-53 66 M52 44 L60 66 M45 44 L53 66" stroke={HOT} strokeWidth={3} />
        <path d="M-6 47 L0 57 L6 47" stroke={LIME} strokeWidth={2.6} />
        <path d="M30 -44 A64 64 0 0 1 60 22" stroke="#7aa2ff" strokeWidth={4} opacity={0.55} />
      </g>
      <ellipse rx={64} ry={64} stroke={INK} strokeWidth={4} />
      <ellipse cx={-44} cy={-18} rx={7} ry={4.4} transform="rotate(-50 -44 -18)" fill="#fff" opacity={0.55} />

      {/* Sweatband tails flick with every rep. */}
      <g {...part(f, "tails")}>
        <path d="M0 -4 L24 -14 L21 -1 Z" fill={HOT} stroke={INK} strokeWidth={2.6} />
        <path d="M0 2 L22 8 L13 15 Z" fill={HOT} stroke={INK} strokeWidth={2.6} />
      </g>

      <g {...part(f, "effort")} stroke={INK} strokeWidth={3}>
        <path d="M-74 -22 L-86 -28 M-76 -8 L-90 -8 M-74 6 L-86 12" />
        <path d="M74 -22 L86 -28 M76 -8 L90 -8 M74 6 L86 12" />
      </g>

      <g {...part(f, "cheekL")}><ellipse rx={9} ry={6} fill={HOT} opacity={0.5} /></g>
      <g {...part(f, "cheekR")}><ellipse rx={9} ry={6} fill={HOT} opacity={0.5} /></g>

      <g {...part(f, "eyeOpen")}>
        {(["L", "R"] as const).map((side) => <g key={side} transform={`translate(${side === "L" ? -21 : 21} -8)`}>
          <g {...part(f, `eyeLid${side}`)}>
            <ellipse rx={10} ry={12} fill="#fff" stroke={INK} strokeWidth={3} />
            <g {...part(f, `pupil${side}`)}><circle r={5.6} fill={INK} /><circle cx={-1.9} cy={-2.2} r={1.9} fill="#fff" /></g>
          </g>
        </g>)}
      </g>
      <g {...part(f, "squint")} stroke={INK} strokeWidth={4.6}>
        <path d="M-30 -15 L-14 -8 L-30 -1" />
        <path d="M30 -15 L14 -8 L30 -1" />
      </g>
      <g {...part(f, "happy")} stroke={INK} strokeWidth={4.4}>
        <path d="M-30 -5 Q-21 -16 -12 -5" />
        <path d="M12 -5 Q21 -16 30 -5" />
      </g>
      <g {...part(f, "browL")}><path d="M-10 0 H10" stroke={INK} strokeWidth={5.5} /></g>
      <g {...part(f, "browR")}><path d="M-10 0 H10" stroke={INK} strokeWidth={5.5} /></g>

      <path {...part(f, "mouthSet")} d="M-9 22 Q0 18.5 9 22" stroke={INK} strokeWidth={4} />
      <path {...part(f, "mouthSmile")} d="M-11 17 Q0 29 11 17" stroke={INK} strokeWidth={4} />
      <g {...part(f, "mouthGrit")}>
        <rect x={-14} y={-7.5} width={28} height={15} rx={6} fill="#fff" stroke={INK} strokeWidth={3} />
        <path d="M-13 0 H13 M-7 -7 V7 M0 -7 V7 M7 -7 V7" stroke={INK} strokeWidth={1.7} />
      </g>
      <g {...part(f, "mouthOpen")}>
        <ellipse rx={10} ry={10} fill="#3a0a1f" stroke={INK} strokeWidth={3} vectorEffect="non-scaling-stroke" />
        <ellipse cy={5} rx={6.5} ry={3.6} fill="#ff6fa5" />
      </g>
    </g>

    {fist("L")}{fist("R")}

    {Array.from({ length: drops }, (_, index) => <path key={index} data-drop="" opacity={0} d="M0 -8 C4 -3 5.5 1.5 0 6.5 C-5.5 1.5 -4 -3 0 -8Z" fill="#9fe8ff" stroke={INK} strokeWidth={1.8} />)}
    <rect x={-700} y={FLOOR} width={1720} height={1} fill="none" />
  </svg>;
}
