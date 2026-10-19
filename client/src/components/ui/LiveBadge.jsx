/** Glowing red badge with a pulsing dot, for fresh school news. */
export default function LiveBadge({ children, className = '' }) {
  return (
    <span className={`live-badge ${className}`}>
      <span className="live-badge__dot" aria-hidden="true" />
      {children}
    </span>
  );
}
