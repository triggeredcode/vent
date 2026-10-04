import { useId } from "react";
import styles from "../breathe.module.css";

/** The cloud silhouette: a soft dome with two shoulder puffs, flat-ish bottom. */
const BODY =
  "M120 50C144 50 160 61 166 78C188 80 203 97 202 118C215 128 221 144 217 160C212 186 186 200 152 201L88 201C54 200 28 186 23 160C19 144 25 128 38 118C37 97 52 80 74 78C80 61 96 50 120 50Z";

/**
 * Puff — VENT's breathe-mode spirit. A pastel cloud drawn in layered gradients so it reads soft and
 * translucent. Every part is its own group so CSS (driven by data-phase on an ancestor and the
 * --breath / --voice / --lvl custom properties) can articulate it.
 */
export function Spirit({ className }: { className?: string }) {
  const raw = useId();
  const id = `puff${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ref = (name: string) => `url(#${id}-${name})`;

  return (
    <svg className={`${styles.spirit} ${className ?? ""}`} viewBox="0 0 240 240" aria-hidden="true" overflow="visible">
      <defs>
        <radialGradient id={`${id}-body`} cx="38%" cy="28%" r="80%">
          <stop offset="0" stopColor="var(--sp-hi)" />
          <stop offset=".42" stopColor="var(--sp-mid)" />
          <stop offset=".8" stopColor="var(--sp-low)" />
          <stop offset="1" stopColor="var(--sp-rim)" />
        </radialGradient>
        <linearGradient id={`${id}-sheen`} x1="1" y1="0" x2=".2" y2=".9">
          <stop offset="0" stopColor="var(--a3)" stopOpacity=".75" />
          <stop offset=".45" stopColor="var(--a3)" stopOpacity="0" />
          <stop offset=".7" stopColor="var(--a4)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--a4)" stopOpacity=".4" />
        </linearGradient>
        <radialGradient id={`${id}-belly`} cx="50%" cy="72%" r="42%">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-aura`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--glow)" stopOpacity=".95" />
          <stop offset=".55" stopColor="var(--glow)" stopOpacity=".35" />
          <stop offset="1" stopColor="var(--glow)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-cheek`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--cheek)" stopOpacity=".95" />
          <stop offset="1" stopColor="var(--cheek)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-arm`} cx="40%" cy="30%" r="80%">
          <stop offset="0" stopColor="var(--sp-hi)" />
          <stop offset=".6" stopColor="var(--sp-low)" />
          <stop offset="1" stopColor="var(--sp-rim)" />
        </radialGradient>
        <clipPath id={`${id}-clip`}><path d={BODY} /></clipPath>
        <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" /></filter>
        <filter id={`${id}-softer`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" /></filter>
        <filter id={`${id}-tiny`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" /></filter>
      </defs>

      <ellipse className={styles.shadow} cx="120" cy="226" rx="70" ry="8" fill="var(--shadow)" filter={ref("soft")} />

      <g className={styles.float}>
        <g className={styles.lean}>
          <g className={styles.nod}>
            <g className={styles.body}>
              <ellipse className={styles.aura} cx="120" cy="128" rx="118" ry="104" fill={ref("aura")} />

              <path d={BODY} fill={ref("body")} />
              <g clipPath={ref("clip")}>
                <path d={BODY} fill={ref("sheen")} style={{ mixBlendMode: "soft-light" }} />
                <path d={BODY} fill={ref("sheen")} opacity=".35" />
                <ellipse cx="120" cy="214" rx="100" ry="30" fill="var(--sp-rim)" opacity=".55" filter={ref("softer")} />
                <ellipse cx="120" cy="168" rx="70" ry="34" fill={ref("belly")} />
                {/* inner rim light: a blurred white stroke clipped to the body reads as glow from within */}
                <path d={BODY} fill="none" stroke="#fff" strokeWidth="10" opacity=".55" filter={ref("soft")} />
                <ellipse cx="84" cy="80" rx="26" ry="13" fill="#fff" opacity=".85" filter={ref("soft")} transform="rotate(-24 84 80)" />
                <ellipse cx="172" cy="104" rx="10" ry="6" fill="#fff" opacity=".5" filter={ref("tiny")} transform="rotate(30 172 104)" />
              </g>
              <circle cx="78" cy="76" r="3.2" fill="#fff" opacity=".95" />
              <path d={BODY} fill="none" stroke="var(--sp-line)" strokeWidth="1" opacity=".3" />

              <g className={styles.armL}>
                <ellipse cx="60" cy="184" rx="14" ry="17" fill={ref("arm")} stroke="var(--sp-line)" strokeOpacity=".35" strokeWidth="1" transform="rotate(-32 60 184)" />
                <ellipse cx="55" cy="178" rx="4.5" ry="6" fill="#fff" opacity=".7" filter={ref("tiny")} transform="rotate(-32 55 178)" />
              </g>
              <g className={styles.armR}>
                <ellipse cx="180" cy="184" rx="14" ry="17" fill={ref("arm")} stroke="var(--sp-line)" strokeOpacity=".35" strokeWidth="1" transform="rotate(32 180 184)" />
                <ellipse cx="176" cy="177" rx="4.5" ry="6" fill="#fff" opacity=".7" filter={ref("tiny")} transform="rotate(32 176 177)" />
              </g>

              <g className={styles.face}>
                <ellipse className={styles.cheek} cx="76" cy="152" rx="17" ry="11" fill={ref("cheek")} />
                <ellipse className={styles.cheek} cx="164" cy="152" rx="17" ry="11" fill={ref("cheek")} />

                <g className={styles.eyesClosed} fill="none" stroke="var(--face)" strokeWidth="4.4" strokeLinecap="round">
                  <path d="M84 133Q96 144 108 133" />
                  <path d="M132 133Q144 144 156 133" />
                  <path d="M85 136.5l-4 3.5M107 136.5l4 3.5M133 136.5l-4 3.5M155 136.5l4 3.5" strokeWidth="2.4" opacity=".55" />
                </g>
                <g className={styles.eyesHappy} fill="none" stroke="var(--face)" strokeWidth="4.4" strokeLinecap="round">
                  <path d="M85 138Q96 126 107 138" />
                  <path d="M133 138Q144 126 155 138" />
                </g>
                <g className={styles.eyesOpen}>
                  <g className={styles.eyeL}>
                    <ellipse cx="96" cy="134" rx="8.2" ry="10" fill="var(--face)" />
                    <circle cx="93" cy="130" r="3.1" fill="#fff" />
                    <circle cx="99.5" cy="139" r="1.4" fill="#fff" opacity=".8" />
                  </g>
                  <g className={styles.eyeR}>
                    <ellipse cx="144" cy="134" rx="8.2" ry="10" fill="var(--face)" />
                    <circle cx="141" cy="130" r="3.1" fill="#fff" />
                    <circle cx="147.5" cy="139" r="1.4" fill="#fff" opacity=".8" />
                  </g>
                </g>

                <path className={styles.smile} d="M113 154Q120 160.5 127 154" fill="none" stroke="var(--face)" strokeWidth="3.4" strokeLinecap="round" />
                <g className={styles.mouth}>
                  <ellipse cx="120" cy="156" rx="7" ry="6.5" fill="var(--mouth)" />
                  <ellipse cx="120" cy="160" rx="4.4" ry="2.6" fill="var(--tongue)" />
                </g>
              </g>
            </g>
          </g>
        </g>

        <g className={styles.zzz} fill="var(--face)">
          <text x="190" y="62">z</text>
          <text x="204" y="40">z</text>
        </g>
        <g className={styles.dots} fill="#fff" stroke="var(--sp-line)" strokeWidth="1.4">
          <circle cx="180" cy="58" r="3.6" />
          <circle cx="194" cy="44" r="4.6" />
          <circle cx="210" cy="26" r="5.8" />
        </g>
        <g className={styles.sparkles} fill="#fff">
          <path d="M40 66l2.4 6.6 6.6 2.4-6.6 2.4L40 84l-2.4-6.6L31 75l6.6-2.4z" />
          <path d="M206 92l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6z" />
          <path d="M58 30l1.2 3.3 3.3 1.2-3.3 1.2L58 39l-1.2-3.3-3.3-1.2 3.3-1.2z" />
        </g>
      </g>
    </svg>
  );
}
