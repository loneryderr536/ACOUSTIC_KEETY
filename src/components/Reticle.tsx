export function Reticle({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" stroke="currentColor" strokeWidth="1">
      <circle cx="20" cy="20" r="14" opacity="0.4" />
      <circle cx="20" cy="20" r="6" opacity="0.6" />
      <line x1="20" y1="0" x2="20" y2="10" /><line x1="20" y1="30" x2="20" y2="40" />
      <line x1="0" y1="20" x2="10" y2="20" /><line x1="30" y1="20" x2="40" y2="20" />
    </svg>
  );
}
