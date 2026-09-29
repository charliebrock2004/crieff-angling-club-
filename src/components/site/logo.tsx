/** Club mark: a salmon leaping across the river's arc. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.9" />
      <path d="M9 31c5-3 9-3 15 0s10 3 15 0" fill="none" stroke="#b8782e" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 36c5-3 9-3 15 0s10 3 15 0" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <path
        d="M13 22c4-7 12-10 19-7 2 .9 3.7 2.2 5 3.8l3.5-2.3-1.2 4.6 2.2 3.6-4-1.1c-1.8 1.5-4 2.6-6.5 3-6.6 1.1-13-1.2-18-4.6Z"
        fill="currentColor"
      />
      <circle cx="32.5" cy="19.2" r="0.9" fill="#b8782e" />
    </svg>
  );
}
