/**
 * The gym buddy's skeleton. A Pose is a flat bag of numbers (so poses can be blended frame to frame);
 * `frame(pose)` turns it into SVG attributes keyed by `data-k`, used both for the first render and for
 * every animation frame (the engine writes them straight to the DOM).
 */

export const VIEW = { w: 320, h: 420 };
export const BAR_Y = 130;
export const FLOOR = 404;
export const GRIP_X = 80; // hands sit at 160 ± 80 on the bar
export const HANG_CY = 255;
export const TOP_CY = 150;
export const STAND_CY = FLOOR - 112;

const UPPER = 64;
const FORE = 64;
const THIGH = 28;
const SHIN = 28;
const SHOULDER = { x: 56, y: -2 };
const HIP = { x: 24, y: 50 };

export interface Pose {
  cx: number; cy: number; tilt: number; sx: number; sy: number;
  lhx: number; lhy: number; rhx: number; rhy: number;
  lfx: number; lfy: number; rfx: number; rfy: number;
  toe: number; flex: number; grip: number;
  eyeOpen: number; squint: number; happy: number;
  grit: number; smile: number; open: number; mouthOpen: number;
  puff: number; brow: number; browLift: number; lookX: number; lookY: number;
  effort: number; tails: number; shadow: number;
}

type Pt = { x: number; y: number };
type Attrs = Record<string, string | number>;

export const keys = [
  "cx", "cy", "tilt", "sx", "sy", "lhx", "lhy", "rhx", "rhy", "lfx", "lfy", "rfx", "rfy", "toe", "flex", "grip",
  "eyeOpen", "squint", "happy", "grit", "smile", "open", "mouthOpen", "puff", "brow", "browLift", "lookX", "lookY",
  "effort", "tails", "shadow",
] as const satisfies readonly (keyof Pose)[];

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const r = (value: number) => Math.round(value * 10) / 10;

/** Base hanging pose; every other pose is this plus overrides. */
export function hang(cy = HANG_CY, cx = 160): Pose {
  return {
    cx, cy, tilt: 0, sx: 1, sy: 1,
    lhx: 160 - GRIP_X, lhy: BAR_Y, rhx: 160 + GRIP_X, rhy: BAR_Y,
    lfx: cx - HIP.x - 6, lfy: cy + HIP.y + 54, rfx: cx + HIP.x + 6, rfy: cy + HIP.y + 54,
    toe: 0.8, flex: 0, grip: 1,
    eyeOpen: 1, squint: 0, happy: 0, grit: 0, smile: 0, open: 0, mouthOpen: 0,
    puff: 0, brow: 0.7, browLift: 0, lookX: 0, lookY: -0.6,
    effort: 0, tails: 0, shadow: 0.35,
  };
}

export function stand(cx = 160): Pose {
  const cy = STAND_CY;
  return {
    ...hang(cy, cx),
    lhx: cx - 70, lhy: cy + 50, rhx: cx + 70, rhy: cy + 50,
    lfx: cx - HIP.x - 8, lfy: FLOOR - 8, rfx: cx + HIP.x + 8, rfy: FLOOR - 8,
    toe: 0, grip: 0, lookY: 0, brow: 0, shadow: 1,
  };
}

export function mix(from: Pose, to: Pose, amount: number): Pose {
  const out = { ...from };
  for (const key of keys) out[key] = from[key] + (to[key] - from[key]) * amount;
  return out;
}

/** Two-bone IK: the elbow/knee bends towards `pole`. Unreachable targets are pulled in. */
function ik(root: Pt, target: Pt, a: number, b: number, pole: Pt) {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const dist = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(dist, a + b - 0.01);
  const ux = dx / dist;
  const uy = dy / dist;
  const end = { x: root.x + ux * reach, y: root.y + uy * reach };
  const along = (a * a - b * b + reach * reach) / (2 * reach);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  const mx = root.x + ux * along;
  const my = root.y + uy * along;
  const one = { x: mx - uy * h, y: my + ux * h };
  const two = { x: mx + uy * h, y: my - ux * h };
  const score = (p: Pt) => (p.x - mx) * pole.x + (p.y - my) * pole.y;
  return { joint: score(one) >= score(two) ? one : two, end };
}

const lerpPt = (a: Pt, b: Pt, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const seg = (a: Pt, b: Pt) => `M${r(a.x)} ${r(a.y)}L${r(b.x)} ${r(b.y)}`;
const deg = (a: Pt, b: Pt) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;

export function frame(p: Pose): Record<string, Attrs> {
  const rad = p.tilt * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const world = (x: number, y: number): Pt => ({ x: p.cx + (x * p.sx) * cos - (y * p.sy) * sin, y: p.cy + (x * p.sx) * sin + (y * p.sy) * cos });

  const out: Record<string, Attrs> = {
    body: { transform: `translate(${r(p.cx)} ${r(p.cy)}) rotate(${r(p.tilt)}) scale(${p.sx.toFixed(3)} ${p.sy.toFixed(3)})` },
    eyeOpen: { opacity: clamp(1 - p.squint - p.happy).toFixed(2) },
    eyeLidL: { transform: `scale(1 ${clamp(p.eyeOpen, 0.08).toFixed(2)})` },
    eyeLidR: { transform: `scale(1 ${clamp(p.eyeOpen, 0.08).toFixed(2)})` },
    pupilL: { transform: `translate(${r(p.lookX * 3.6)} ${r(p.lookY * 4)})` },
    pupilR: { transform: `translate(${r(p.lookX * 3.6)} ${r(p.lookY * 4)})` },
    squint: { opacity: clamp(p.squint).toFixed(2) },
    happy: { opacity: clamp(p.happy).toFixed(2) },
    browL: { transform: `translate(-21 ${r(-26 - p.browLift * 5)}) rotate(${r(p.brow * 17)})` },
    browR: { transform: `translate(21 ${r(-26 - p.browLift * 5)}) rotate(${r(-p.brow * 17)})` },
    cheekL: { transform: `translate(-39 10) scale(${(0.75 + p.puff * 0.65).toFixed(2)})` },
    cheekR: { transform: `translate(39 10) scale(${(0.75 + p.puff * 0.65).toFixed(2)})` },
    mouthSet: { opacity: clamp(1 - p.grit - p.smile - p.open).toFixed(2) },
    mouthGrit: { opacity: clamp(p.grit).toFixed(2), transform: `translate(0 21) scale(${(0.9 + p.puff * 0.25).toFixed(2)} 1)` },
    mouthSmile: { opacity: clamp(p.smile).toFixed(2) },
    mouthOpen: { opacity: clamp(p.open).toFixed(2), transform: `translate(0 21) scale(${(0.85 + p.mouthOpen * 0.3).toFixed(2)} ${(0.22 + p.mouthOpen * 0.95).toFixed(2)})` },
    effort: { opacity: clamp(p.effort).toFixed(2) },
    tails: { transform: `translate(60 -42) rotate(${r(p.tails)})` },
    shadow: {
      transform: `translate(${r(p.cx)} ${FLOOR}) scale(${(0.55 + p.shadow * 0.45).toFixed(2)} 1)`,
      opacity: (0.12 + p.shadow * 0.2).toFixed(2),
    },
  };

  // Arms: shoulder → elbow → fist, elbows flare outward and down.
  for (const side of ["L", "R"] as const) {
    const sign = side === "L" ? -1 : 1;
    const shoulder = world(SHOULDER.x * sign, SHOULDER.y);
    const target = side === "L" ? { x: p.lhx, y: p.lhy } : { x: p.rhx, y: p.rhy };
    const { joint: elbow, end: hand } = ik(shoulder, target, UPPER, FORE, { x: sign, y: 0.55 });
    const path = `${seg(shoulder, elbow)}L${r(hand.x)} ${r(hand.y)}`;
    out[`arm${side}`] = { d: path };
    out[`band${side}`] = { d: seg(lerpPt(hand, elbow, 0.2), lerpPt(hand, elbow, 0.46)) };
    out[`stripe${side}`] = { d: seg(lerpPt(hand, elbow, 0.31), lerpPt(hand, elbow, 0.35)) };
    // Biceps bulge sits on the upper side of the upper arm.
    const mid = lerpPt(shoulder, elbow, 0.5);
    const len = Math.max(0.001, Math.hypot(elbow.x - shoulder.x, elbow.y - shoulder.y));
    let nx = -(elbow.y - shoulder.y) / len;
    let ny = (elbow.x - shoulder.x) / len;
    if (ny > 0) { nx = -nx; ny = -ny; }
    out[`bulge${side}`] = { transform: `translate(${r(mid.x + nx * 8)} ${r(mid.y + ny * 8)}) scale(${clamp(p.flex, 0.001).toFixed(2)})` };
    // Fist follows the forearm; on the bar it squares up to grip it.
    const along = deg(elbow, hand) + 90;
    const angle = along * (1 - p.grip);
    out[`hand${side}`] = { transform: `translate(${r(hand.x)} ${r(hand.y)}) rotate(${r(angle)}) scale(${sign * -1} 1)` };
  }

  // Legs: hip → knee → ankle, knees bow outward; sneakers point outward.
  for (const side of ["L", "R"] as const) {
    const sign = side === "L" ? -1 : 1;
    const hip = world(HIP.x * sign, HIP.y);
    const target = side === "L" ? { x: p.lfx, y: p.lfy } : { x: p.rfx, y: p.rfy };
    const { joint: knee, end: foot } = ik(hip, target, THIGH, SHIN, { x: sign, y: 0 });
    out[`leg${side}`] = { d: `${seg(hip, knee)}L${r(foot.x)} ${r(foot.y)}` };
    out[`sock${side}`] = { d: seg(foot, lerpPt(foot, knee, 0.55)) };
    out[`shoe${side}`] = { transform: `translate(${r(foot.x)} ${r(foot.y)}) scale(${sign} 1) rotate(${r(p.toe * 48 + p.tilt * sign * 0.5)})` };
  }
  return out;
}
