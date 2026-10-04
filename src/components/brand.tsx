/** VENT's mark: a voice let out — a warm dot with two waves leaving it. Mirrors src/app/icon.svg. */
export function BrandMark({ size = 30 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="18" fill="#263a31" />
    <circle cx="21" cy="43" r="7.5" fill="#f0c947" />
    <path d="M21 27.5A15.5 15.5 0 0 1 36.5 43" fill="none" stroke="#e99377" strokeWidth="5.5" strokeLinecap="round" />
    <path d="M21 15a28 28 0 0 1 28 28" fill="none" stroke="#f8e9b3" strokeWidth="5.5" strokeLinecap="round" />
  </svg>;
}
