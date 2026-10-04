/**
 * Progressive heavy-bag damage. Each landed hit on the current bag adds one mark near where the
 * glove struck; the kind of mark escalates with the bag's hit count:
 *   1–5   scuffs        6–9   dents        10–14  stretch marks / split stitches
 *   15–19 leather tears with stuffing showing (and sand trickling from a couple of them)
 * The 20th hit bursts the bag (handled by the stage).
 *
 * Marks are plain SVG built imperatively (the stage animates outside React), positioned
 * deterministically from the hit number so a bag never looks cluttered or repetitive.
 */

export const HITS_PER_BAG = 20;

const NS = "http://www.w3.org/2000/svg";

type Attrs = Record<string, string | number>;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs, parent?: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent?.appendChild(node);
  return node;
}

export type BagBox = { left: number; width: number; top: number; bottom: number };

export type Spot = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

/** Small deterministic hash → 0–1, so a given hit number always scatters the same way. */
const hash = (n: number, k: number) => {
  const v = Math.sin(n * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Where hit `n` leaves its mark: near the strike height, spread across the bag's face, as far as
 * possible from the marks already there and off the printed patch (best-candidate sampling), so the
 * bag fills up evenly instead of piling every mark in one spot.
 */
export function markPosition(n: number, strikeY: number, box: BagBox, placed: Spot[], avoid: Rect) {
  const minX = box.left + 12;
  const maxX = box.left + box.width - 14;
  const top = Math.max(box.top + 18, strikeY - 62);
  const bottom = Math.min(box.bottom - 20, strikeY + 62);
  let best = { x: minX, y: top };
  let bestScore = -Infinity;
  for (let k = 0; k < 10; k++) {
    const x = minX + hash(n, k) * (maxX - minX);
    const y = top + hash(n, k + 17) * (bottom - top);
    let nearest = 60;
    for (const p of placed) nearest = Math.min(nearest, Math.hypot((p.x - x) * 1.1, p.y - y));
    const onPatch = x > avoid.x - 4 && x < avoid.x + avoid.width + 4 && y > avoid.y - 4 && y < avoid.y + avoid.height + 4;
    // Prefer open leather close to where the glove landed.
    const score = nearest - (onPatch ? 40 : 0) - Math.abs(y - strikeY) * 0.12;
    if (score > bestScore) { bestScore = score; best = { x, y }; }
  }
  return { ...best, angle: Math.round((hash(n, 99) - 0.5) * 46) };
}

/** Builds the mark for hit `n` (1–19) and returns it. `uid` scopes the gradient ids. */
export function buildMark(n: number, x: number, y: number, angle: number, uid: string, className: { sand: string }): SVGGElement {
  const g = el("g", { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle}) scale(1.45)` });
  const url = (name: string) => `url(#${uid}-${name})`;

  if (n <= 5) {
    // Scuff: a dull smudge where the leather's finish has rubbed off, plus a couple of fine scratches.
    el("ellipse", { rx: 7 + (n % 3) * 2, ry: 3.2, fill: url("scuff"), opacity: 0.7 }, g);
    el("path", { d: "M-6 -1.2 L5 -2.6 M-4 1.6 L6.5 0.4", stroke: "#f3c7ae", "stroke-opacity": 0.3, "stroke-width": 0.7, "stroke-linecap": "round", fill: "none" }, g);
  } else if (n <= 9) {
    // Dent: a soft hollow with the leather catching the light on its far rim.
    el("ellipse", { rx: 6.5, ry: 10, fill: url("hollow"), opacity: 0.75 }, g);
    el("path", { d: "M2.6 -8.5 Q8 0 2.6 8.5", stroke: "#ffc4a4", "stroke-opacity": 0.3, "stroke-width": 1.3, "stroke-linecap": "round", fill: "none" }, g);
    el("ellipse", { cx: -3, rx: 5, ry: 2.4, fill: url("scuff"), opacity: 0.6 }, g);
  } else if (n <= 14) {
    if (n % 2 === 0) {
      // Stretch marks: pale strain lines plus a dark hairline crack.
      el("path", { d: "M-8 -4 Q0 -5.5 8 -3.6 M-9 0 Q0 -1.4 9 0.4 M-7 4 Q0 2.8 7.5 4.4", stroke: "#f0b49a", "stroke-opacity": 0.32, "stroke-width": 0.8, "stroke-linecap": "round", fill: "none" }, g);
      el("path", { d: "M-5 -1 L-2 0.6 L0.5 -0.8 L3.4 1 L6 0", stroke: "#1e0202", "stroke-opacity": 0.7, "stroke-width": 0.7, "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" }, g);
    } else {
      // A seam splitting open, with a loose thread hanging from it.
      el("ellipse", { rx: 9, ry: 3, fill: url("scuff"), opacity: 0.5 }, g);
      el("path", { d: "M-11 0 L-3.4 0 M3.4 0 L11 0", stroke: "#f4dcc0", "stroke-opacity": 0.55, "stroke-width": 0.9, "stroke-dasharray": "2.4 1.8", fill: "none" }, g);
      el("ellipse", { rx: 3.6, ry: 1.7, fill: "#1a0202" }, g);
      el("path", { d: "M-3 0.4 q1.6 4.6 -1.2 8.4", stroke: "#f4dcc0", "stroke-opacity": 0.75, "stroke-width": 0.6, "stroke-linecap": "round", fill: "none" }, g);
    }
  } else {
    // Tear: a jagged rip with stuffing bulging through, growing with every hit.
    const s = 1 + (n - 15) * 0.14;
    const t = el("g", { transform: `scale(${s.toFixed(2)})` }, g);
    const rip = "M-10.5 0 L-7 -2.4 L-4 -1.5 L-1 -3.6 L2.4 -2.1 L6.4 -3.1 L10.5 0.2 L6.6 2.8 L2.6 1.9 L-1.6 3.4 L-6 2.3 Z";
    el("ellipse", { cy: 3.8, rx: 12, ry: 3, fill: url("scuff"), opacity: 0.7 }, t);
    el("path", { d: rip, fill: url("tear") }, t);
    // Stuffing: soft, matted cotton bulging up from inside the rip, mostly in shadow.
    el("ellipse", { cx: -1.5, cy: 1, rx: 6.5, ry: 2.2, fill: url("stuff"), opacity: 0.85 }, t);
    el("ellipse", { cx: 3.5, cy: 0.4, rx: 4, ry: 1.7, fill: url("stuff"), opacity: 0.7 }, t);
    el("path", { d: "M-10.5 0 L-7 -2.4 L-4 -1.5 L-1 -3.6 L2.4 -2.1 L6.4 -3.1 L10.5 0.2", stroke: "#e8664a", "stroke-opacity": 0.6, "stroke-width": 0.8, "stroke-linejoin": "round", fill: "none" }, t);
    el("path", { d: "M2.4 -2.1 L4.6 -6.4 L6.4 -3.1 Z", fill: "#8c1c12" }, t);
    el("path", { d: "M-6 2.3 L-1.6 3.4 L2.6 1.9 L6.6 2.8", stroke: "#0a0000", "stroke-opacity": 0.6, "stroke-width": 0.7, fill: "none" }, t);
    if (n === 16 || n === 19) {
      // Sand trickling out of the rip.
      const sand = el("g", { transform: `rotate(${-angle}) translate(0 2.5) scale(${(1 / 1.45).toFixed(3)})` }, g);
      for (let i = 0; i < 6; i++) {
        const grain = el("circle", { cx: ((i * 7) % 3) * 0.6 - 0.6, r: 0.75 + (i % 2) * 0.25, fill: "#e8c89a", class: className.sand }, sand);
        grain.style.animationDelay = `${(-i * 0.16).toFixed(2)}s`;
      }
    }
  }
  return g;
}
