import { BAR_Y, FLOOR, frame, type Pose } from "./rig";

const HOT = "var(--sw-hot, #ff3d8b)";
const LIME = "var(--sw-lime, #c6f432)";
/** Facial line colour: a deep ink-navy, never pure black, so the face reads soft like a vinyl toy. */
const LINE = "#1d1a3a";
/** Light comes from the upper left: highlights are nudged up-left, shadows sit down-right. */
const LIGHT = "translate(-2.4 -3)";
const MID = "translate(-1 -1.3)";

/** Cobalt skin ramp, shadow → highlight, interpolated finely so tubes shade smoothly even at cover size. */
const SKIN = ramp(["#16238a", "#1f36c0", "#2c4deb", "#3f65ff", "#6a8cff", "#c4d3ff"], 11);

function ramp(stops: string[], steps: number) {
  const rgb = stops.map((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
  return Array.from({ length: steps }, (_, index) => {
    const x = (index / (steps - 1)) * (rgb.length - 1);
    const i = Math.min(rgb.length - 2, Math.floor(x));
    const t = x - i;
    return `#${rgb[i].map((c, k) => Math.round(c + (rgb[i + 1][k] - c) * t).toString(16).padStart(2, "0")).join("")}`;
  });
}

/** Static attributes for one rig part, so the first paint matches what the engine will write each frame. */
function part(attrs: Record<string, Record<string, string | number>>, key: string) {
  return { "data-k": key, ...attrs[key] };
}

/** A glossy, refractive sweat drop (one group, so the engine can move it with a single transform). */
export function Drop({ fill, ...rest }: { fill: string } & React.SVGProps<SVGGElement>) {
  return <g {...rest}>
    <path d="M0 -8 C4 -3 5.5 1.5 0 6.5 C-5.5 1.5 -4 -3 0 -8Z" fill={fill} stroke="rgba(18, 70, 150, .5)" strokeWidth={0.9} />
    <ellipse cx={1.4} cy={3} rx={2.2} ry={1.1} fill="#fff" opacity={0.55} />
    <ellipse cx={-1.5} cy={-1.4} rx={1.05} ry={2.2} transform="rotate(18 -1.5 -1.4)" fill="#fff" />
  </g>;
}

/** Gradient defs for a drop; shared by the stage and the cover. */
export function DropGradient({ id }: { id: string }) {
  return <linearGradient id={id} x1="0.2" y1="0" x2="0.75" y2="1">
    <stop offset="0" stopColor="#f2fcff" stopOpacity="0.95" />
    <stop offset="0.45" stopColor="#8fdcff" stopOpacity="0.85" />
    <stop offset="1" stopColor="#2a7be6" stopOpacity="0.95" />
  </linearGradient>;
}

/**
 * Bolt, the gym buddy, rendered like a soft vinyl toy: a cobalt sphere with a cream face, glossy eyes,
 * terry-cloth sweatband and wristbands. No outlines: form comes from gradients, rim light, ambient
 * occlusion where limbs meet the body, and soft contact shadows.
 * Everything that moves carries data-k so the engine can write the next frame directly.
 */
export function Figure({ pose, uid, drops = 0, className, viewBox = "0 0 320 420", align = "xMidYMax meet" }: { pose: Pose; uid: string; drops?: number; className?: string; viewBox?: string; align?: string }) {
  const f = frame(pose);
  const id = (name: string) => `sw-${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  /**
   * A tube with volume: concentric strokes stepping from the shadow tone to the lit tone, each nudged a little
   * further toward the light, so the cross-section reads as a smooth cylinder rather than an outlined hose.
   */
  const tube = (key: string, width: number, tones: string[], lightOpacity = 0.55) => <>
    {tones.map((tone, index) => {
      const t = index / (tones.length - 1);
      const last = index === tones.length - 1;
      return <g key={index} transform={`translate(${(-2.2 * t).toFixed(2)} ${(-2.8 * t).toFixed(2)})`}>
        <path {...part(f, key)} stroke={tone} strokeWidth={width * (1 - Math.pow(t, 0.85) * 0.84)} opacity={last ? lightOpacity : 1} />
      </g>;
    })}
  </>;


  const arm = (side: "L" | "R") => <>
    {tube(`arm${side}`, 19, SKIN)}
    <g {...part(f, `bulge${side}`)}><circle r={10.5} fill={url("ball")} /><ellipse cx={-3} cy={-4} rx={4} ry={2.4} fill="#e2eaff" opacity={0.7} /></g>
  </>;
  const wrist = (side: "L" | "R") => <>
    <path {...part(f, `band${side}`)} stroke="#9c1452" strokeWidth={25} />
    <g transform={MID}><path {...part(f, `band${side}`)} stroke={HOT} strokeWidth={20} /></g>
    {/* Terry ribs: a dashed stroke along the cuff draws stripes across it. */}
    <path {...part(f, `band${side}`)} stroke="rgba(90, 0, 40, .26)" strokeWidth={22} strokeDasharray="1.1 1.9" strokeLinecap="butt" />
    <path {...part(f, `stripe${side}`)} stroke="#d9dbe6" strokeWidth={23} strokeLinecap="butt" />
    <g transform={MID}><path {...part(f, `stripe${side}`)} stroke="#fff" strokeWidth={18} strokeLinecap="butt" /></g>
    <g transform={LIGHT}><path {...part(f, `band${side}`)} stroke="#fff" strokeWidth={6} opacity={0.32} /></g>
  </>;
  const leg = (side: "L" | "R") => <>
    {tube(`leg${side}`, 15, SKIN, 0.45)}
    <path {...part(f, `sock${side}`)} stroke="#b9bfd3" strokeWidth={15} />
    <g transform={MID}><path {...part(f, `sock${side}`)} stroke="#fbfbff" strokeWidth={11} /></g>
    <path {...part(f, `sock${side}`)} stroke="rgba(80, 90, 130, .2)" strokeWidth={13} strokeDasharray="1 2" strokeLinecap="butt" />
    <g {...part(f, `shoe${side}`)}>
      <ellipse cx={6} cy={13} rx={17} ry={3.2} fill="rgba(10, 14, 40, .25)" />
      <path d="M-11 9 L-11 -3 Q-10 -10 -2 -9 L5 -6 Q18 -3 22 4 L22 9 Q22 12 18 12 L-8 12 Q-11 12 -11 9Z" fill={url("shoe")} />
      <path d="M-11 7.5 H22 V9 Q22 12.5 18 12.5 L-8 12.5 Q-11 12.5 -11 9Z" fill={url("sole")} />
      <path d="M-4 3 Q6 4 13 -2" stroke={HOT} strokeWidth={3.4} />
      <path d="M-2 -6 L1 -2 M3 -5 L6 -1" stroke="#9aa2bd" strokeWidth={1.4} />
      <path d="M-8 -3 Q-6 -8 0 -8" stroke="#fff" strokeWidth={1.8} opacity={0.9} />
    </g>
  </>;
  const fist = (side: "L" | "R") => <g {...part(f, `hand${side}`)}>
    <ellipse cx={2} cy={7} rx={15} ry={8} fill={url("ao")} opacity={0.7} />
    <rect x={-13} y={-12} width={26} height={22} rx={10.5} fill={url("ball")} />
    <path d="M-5.5 -11 V-5 M0.5 -11.5 V-4.5 M6.5 -11 V-5" stroke="#1a2a9a" strokeWidth={1.6} opacity={0.55} />
    <ellipse cx={-11} cy={2} rx={5} ry={6.5} fill={url("ball")} />
    <path d="M-7 4 Q-9 8 -13 7" stroke="#1a2a9a" strokeWidth={1.2} opacity={0.45} />
    <ellipse cx={-3} cy={-7.5} rx={5} ry={2.2} fill="#e4ecff" opacity={0.75} />
  </g>;

  return <svg className={className} viewBox={viewBox} preserveAspectRatio={align} overflow={drops ? "visible" : "hidden"} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <defs>
      {/* Sphere: key light up-left, deep core shadow down-right. */}
      <radialGradient id={id("body")} cx="0.36" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#b7caff" />
        <stop offset="0.18" stopColor="#6f8fff" />
        <stop offset="0.48" stopColor="#3459f6" />
        <stop offset="0.8" stopColor="#1f37c4" />
        <stop offset="1" stopColor="#14228a" />
      </radialGradient>
      {/* Small rounded forms (fists, biceps). */}
      <radialGradient id={id("ball")} cx="0.35" cy="0.3" r="0.85">
        <stop offset="0" stopColor="#9fb6ff" />
        <stop offset="0.45" stopColor="#3d63ff" />
        <stop offset="1" stopColor="#1a2aa0" />
      </radialGradient>
      {/* Cream face, like the home mascot, fading softly into the cobalt. */}
      <radialGradient id={id("face")} cx="0.42" cy="0.34" r="0.66" fx="0.4" fy="0.3">
        <stop offset="0" stopColor="#fffbf3" />
        <stop offset="0.55" stopColor="#f7ebda" />
        <stop offset="0.86" stopColor="#ead7c4" />
        <stop offset="0.95" stopColor="#d9c6c6" stopOpacity="0.7" />
        <stop offset="1" stopColor="#c8b8d0" stopOpacity="0" />
      </radialGradient>
      {/* Edge falloff over everything on the sphere, so the face and gear wrap around it. */}
      <radialGradient id={id("shade")} cx="0.38" cy="0.32" r="0.78">
        <stop offset="0.5" stopColor="#0c1250" stopOpacity="0" />
        <stop offset="0.85" stopColor="#0c1250" stopOpacity="0.22" />
        <stop offset="1" stopColor="#0a0f40" stopOpacity="0.5" />
      </radialGradient>
      {/* Cool rim light on the far edge and warm-lime bounce from the poster below. */}
      <radialGradient id={id("rim")} cx="0.3" cy="0.24" r="0.78">
        <stop offset="0.84" stopColor="#bfeaff" stopOpacity="0" />
        <stop offset="0.97" stopColor="#c9efff" stopOpacity="0.22" />
        <stop offset="1" stopColor="#e2f8ff" stopOpacity="0.42" />
      </radialGradient>
      <radialGradient id={id("bounce")} cx="0.5" cy="1" r="0.6">
        <stop offset="0" stopColor="#d9ff6a" stopOpacity="0.22" />
        <stop offset="1" stopColor="#d9ff6a" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={id("spec")}>
        <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
        <stop offset="0.5" stopColor="#fff" stopOpacity="0.35" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={id("ao")}>
        <stop offset="0" stopColor="#070a2c" stopOpacity="0.55" />
        <stop offset="1" stopColor="#070a2c" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={id("blush")}>
        <stop offset="0" stopColor="#ff7aa8" stopOpacity="0.75" />
        <stop offset="1" stopColor="#ff7aa8" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={id("eye")} cx="0.45" cy="0.62" r="0.65">
        <stop offset="0" stopColor="#6a4632" />
        <stop offset="0.5" stopColor="#2c1a14" />
        <stop offset="1" stopColor="#120a08" />
      </radialGradient>
      {/* Fabric: light on the top fold, shadow underneath. Painted over the tone colour. */}
      <linearGradient id={id("fabric")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.4" />
        <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.7" stopColor="#3a0020" stopOpacity="0.1" />
        <stop offset="1" stopColor="#3a0020" stopOpacity="0.45" />
      </linearGradient>
      <pattern id={id("terry")} width="2.6" height="4" patternUnits="userSpaceOnUse">
        <rect width="1.1" height="4" fill="#5a0028" opacity="0.22" />
      </pattern>
      <linearGradient id={id("shorts")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3a3f52" />
        <stop offset="1" stopColor="#12141c" />
      </linearGradient>
      <linearGradient id={id("teeth")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" />
        <stop offset="1" stopColor="#d6daec" />
      </linearGradient>
      <radialGradient id={id("mouth")} cx="0.5" cy="0.35">
        <stop offset="0" stopColor="#7a1f3c" />
        <stop offset="1" stopColor="#2a0814" />
      </radialGradient>
      <linearGradient id={id("shoe")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#d3d8e8" />
      </linearGradient>
      <linearGradient id={id("sole")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e4ff7a" />
        <stop offset="1" stopColor="#7fa012" />
      </linearGradient>
      <linearGradient id={id("steel")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.3" stopColor="#dfe3ea" />
        <stop offset="0.62" stopColor="#8f96a3" />
        <stop offset="1" stopColor="#4a505c" />
      </linearGradient>
      <linearGradient id={id("grip")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4a4f5e" />
        <stop offset="1" stopColor="#15171f" />
      </linearGradient>
      <pattern id={id("knurl")} width="5" height="13" patternUnits="userSpaceOnUse" patternTransform="skewX(-30)">
        <rect width="1.6" height="13" fill={LIME} opacity="0.8" />
      </pattern>
      <radialGradient id={id("shadow")}>
        <stop offset="0" stopColor="#060814" stopOpacity="1" />
        <stop offset="0.5" stopColor="#060814" stopOpacity="0.45" />
        <stop offset="1" stopColor="#060814" stopOpacity="0" />
      </radialGradient>
      <DropGradient id={id("drop")} />
      <clipPath id={id("clip")}><ellipse rx={64} ry={64} /></clipPath>
    </defs>

    <ellipse {...part(f, "shadow")} rx={70} ry={10} fill={url("shadow")} />

    {/* The bar runs wall to wall: the phone is the doorway. */}
    <g>
      <rect x={-700} y={BAR_Y + 4} width={1720} height={6} rx={3} fill="#0a0d24" opacity={0.14} />
      <rect x={-700} y={BAR_Y - 6.5} width={1720} height={13} rx={6.5} fill={url("steel")} />
      <rect x={58} y={BAR_Y - 7} width={44} height={14} rx={3} fill={url("grip")} />
      <rect x={218} y={BAR_Y - 7} width={44} height={14} rx={3} fill={url("grip")} />
      <rect x={58} y={BAR_Y - 7} width={44} height={14} rx={3} fill={url("knurl")} />
      <rect x={218} y={BAR_Y - 7} width={44} height={14} rx={3} fill={url("knurl")} />
      <path d={`M-700 ${BAR_Y - 3.2} H1020`} stroke="#fff" strokeWidth={1.6} opacity={0.9} />
    </g>

    {arm("L")}{arm("R")}
    {wrist("L")}{wrist("R")}
    {leg("L")}{leg("R")}

    {/* Ambient occlusion where the limbs tuck under the body. */}
    <g {...part(f, "body")}>
      <ellipse cx={-54} cy={2} rx={20} ry={18} fill={url("ao")} />
      <ellipse cx={54} cy={2} rx={20} ry={18} fill={url("ao")} />
      <ellipse cx={-24} cy={56} rx={16} ry={12} fill={url("ao")} />
      <ellipse cx={24} cy={56} rx={16} ry={12} fill={url("ao")} />
    </g>

    <g {...part(f, "body")}>
      <ellipse rx={64} ry={64} fill={url("body")} />
      <g clipPath={url("clip")}>
        <ellipse cy={8} rx={44} ry={37} fill={url("face")} />
        <ellipse cx={-30} cy={13} rx={12} ry={8} fill={url("blush")} />
        <ellipse cx={30} cy={13} rx={12} ry={8} fill={url("blush")} />

        {/* Shorts: soft charcoal fabric, ribbed lime waistband. */}
        <path d="M-70 36 Q0 52 70 36 L70 80 L-70 80Z" fill={url("shorts")} />
        <path d="M-70 33 Q0 49 70 33 L70 39 Q0 55 -70 39Z" fill={LIME} />
        <path d="M-70 33 Q0 49 70 33 L70 39 Q0 55 -70 39Z" fill={url("terry")} />
        <path d="M-70 33 Q0 49 70 33" stroke="#fff" strokeWidth={1.2} opacity={0.55} />
        <path d="M-50 47 L-58 70 M-44 48 L-52 72 M50 47 L58 70 M44 48 L52 72" stroke={HOT} strokeWidth={2.6} opacity={0.9} />
        <path d="M-70 40 Q0 56 70 40" stroke="#05060c" strokeWidth={3} opacity={0.35} />

        {/* Terry-cloth sweatband: tone colour, rib texture, a fold of light on top, AO underneath. */}
        <path d="M-70 -24 Q0 -42 70 -24" stroke="#070a2c" strokeWidth={7} opacity={0.22} />
        <path d="M-70 -46 Q0 -64 70 -46 L70 -27 Q0 -45 -70 -27Z" fill={HOT} />
        <path d="M-70 -46 Q0 -64 70 -46 L70 -27 Q0 -45 -70 -27Z" fill={url("terry")} />
        <path d="M-70 -46 Q0 -64 70 -46 L70 -27 Q0 -45 -70 -27Z" fill={url("fabric")} />
        <path d="M-70 -37 Q0 -55 70 -37" stroke="#fff" strokeWidth={3} opacity={0.95} />
        <path d="M-70 -45 Q0 -63 70 -45" stroke="#fff" strokeWidth={1.4} opacity={0.4} />

        <ellipse rx={64} ry={64} fill={url("shade")} />
        <ellipse cy={30} rx={64} ry={34} fill={url("bounce")} />
        <ellipse rx={64} ry={64} fill={url("rim")} />
      </g>
      {/* Vinyl gloss: a broad soft sheen on the open flank plus a crisp window spark. */}
      <ellipse cx={-47} cy={-6} rx={8} ry={19} transform="rotate(22 -47 -6)" fill={url("spec")} opacity={0.6} />
      <ellipse cx={-50} cy={-16} rx={2.4} ry={5} transform="rotate(24 -50 -16)" fill="#fff" opacity={0.85} />
      <ellipse cx={-26} cy={-52} rx={10} ry={3.5} transform="rotate(-20 -26 -52)" fill={url("spec")} opacity={0.45} />

      {/* Sweatband tails flick with every rep. */}
      <g {...part(f, "tails")}>
        <path d="M0 -4 L24 -14 Q25 -7 21 -1 Z" fill={HOT} />
        <path d="M0 -4 L24 -14 Q25 -7 21 -1 Z" fill={url("fabric")} />
        <path d="M0 2 L22 8 Q19 13 13 15 Z" fill={HOT} />
        <path d="M0 2 L22 8 Q19 13 13 15 Z" fill="#3a0020" opacity={0.25} />
        <ellipse cx={1} cy={-1} rx={4} ry={5} fill={HOT} />
      </g>

      <g {...part(f, "effort")} stroke="#18237a" strokeWidth={2.6} opacity={0.6}>
        <path d="M-73 -24 Q-80 -28 -86 -27 M-76 -8 L-88 -8 M-73 8 Q-80 12 -86 11" />
        <path d="M73 -24 Q80 -28 86 -27 M76 -8 L88 -8 M73 8 Q80 12 86 11" />
      </g>

      <g {...part(f, "cheekL")}><ellipse rx={9} ry={6} fill={url("blush")} opacity={0.8} /></g>
      <g {...part(f, "cheekR")}><ellipse rx={9} ry={6} fill={url("blush")} opacity={0.8} /></g>

      {/* Glossy eyes, mascot style: deep brown, two catch-lights, no outline. */}
      <g {...part(f, "eyeOpen")}>
        {(["L", "R"] as const).map((side) => <g key={side} transform={`translate(${side === "L" ? -21 : 21} -8)`}>
          <g {...part(f, `eyeLid${side}`)}>
            <g {...part(f, `pupil${side}`)}>
              <ellipse cy={1.2} rx={9} ry={10.6} fill="#c9b8a8" opacity={0.45} />
              <ellipse rx={8.4} ry={10.2} fill={url("eye")} />
              <ellipse cx={-2.6} cy={-4} rx={3} ry={2.6} fill="#fff" />
              <circle cx={2.8} cy={3.4} r={1.3} fill="#fff" opacity={0.8} />
            </g>
          </g>
        </g>)}
      </g>
      <g {...part(f, "squint")} stroke={LINE} strokeWidth={3.6}>
        <path d="M-29 -14 Q-20 -11 -14 -8 Q-20 -5 -29 -2" />
        <path d="M29 -14 Q20 -11 14 -8 Q20 -5 29 -2" />
      </g>
      <g {...part(f, "happy")} stroke={LINE} strokeWidth={3.4}>
        <path d="M-29 -5 Q-21 -15 -13 -5" />
        <path d="M13 -5 Q21 -15 29 -5" />
      </g>
      <g {...part(f, "browL")}><path d="M-8 1.5 Q0 -2.5 8 1.5" stroke={LINE} strokeWidth={3.6} /></g>
      <g {...part(f, "browR")}><path d="M-8 1.5 Q0 -2.5 8 1.5" stroke={LINE} strokeWidth={3.6} /></g>

      <path {...part(f, "mouthSet")} d="M-8 22 Q0 19 8 22" stroke={LINE} strokeWidth={2.8} />
      <path {...part(f, "mouthSmile")} d="M-10 18 Q0 27 10 18" stroke={LINE} strokeWidth={2.8} />
      <g {...part(f, "mouthGrit")}>
        <rect x={-15} y={-8.5} width={30} height={17} rx={7.5} fill={url("mouth")} />
        <rect x={-13} y={-6.5} width={26} height={13} rx={5.5} fill={url("teeth")} />
        <path d="M-12 0 H12 M-6.5 -6 V6 M0 -6.5 V6.5 M6.5 -6 V6" stroke="#aab1cc" strokeWidth={1.1} />
        <path d="M-10 -4.5 H4" stroke="#fff" strokeWidth={1.4} />
      </g>
      <g {...part(f, "mouthOpen")}>
        <ellipse rx={10} ry={10} fill={url("mouth")} />
        <ellipse cy={5} rx={6.5} ry={3.6} fill="#ff7fa9" />
        <ellipse cx={-3} cy={-5} rx={3.5} ry={1.6} fill="#fff" opacity={0.18} />
      </g>
    </g>

    {fist("L")}{fist("R")}

    {Array.from({ length: drops }, (_, index) => <Drop key={index} data-drop="" opacity={0} fill={url("drop")} />)}
    <rect x={-700} y={FLOOR} width={1720} height={1} fill="none" />
  </svg>;
}
