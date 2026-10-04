/** Haan's mark: a listening speech-bubble face. Mirrors src/app/icon.svg. */
export function BrandMark({ size = 30 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="18" fill="#f0c947" />
    <circle cx="50" cy="14" r="10" fill="#e99377" />
    <path d="M13 31c0-9.9 8.5-18 19-18s19 8.1 19 18-8.5 18-19 18c-2.7 0-5.3-.5-7.6-1.5L14 51l2.6-8.9C14.3 39 13 35.1 13 31z" fill="#263a31" />
    <circle cx="25.5" cy="30" r="3" fill="#f8e9b3" />
    <circle cx="38.5" cy="30" r="3" fill="#f8e9b3" />
    <path d="M27 37.5c2.9 2.6 7.1 2.6 10 0" stroke="#f8e9b3" strokeWidth="2.8" strokeLinecap="round" fill="none" />
  </svg>;
}
