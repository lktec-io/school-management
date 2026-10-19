import { useState } from 'react';

/** School crest: the uploaded logo when available, otherwise a seal drawn from the school's initials. */
export default function Crest({ name = '', size = 40, inverted = false, logoSrc = null }) {
  const [failedSrc, setFailedSrc] = useState(null);

  if (logoSrc && failedSrc !== logoSrc) {
    return (
      <img
        src={logoSrc}
        alt={`${name} logo`}
        width={size}
        height={size}
        className="crest crest--image"
        onError={() => setFailedSrc(logoSrc)}
      />
    );
  }

  const initials = name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word) && !['of', 'the', 'and', 'school'].includes(word.toLowerCase()))
    .slice(0, 3)
    .map((word) => word[0].toUpperCase())
    .join('') || 'S';
  const ink = inverted ? '#ffffff' : '#1e3a8a';
  const accent = inverted ? '#10b981' : '#94a3b8';

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`${name} crest`} className="crest">
      <circle cx="32" cy="32" r="30" fill="none" stroke={ink} strokeWidth="3" />
      <circle cx="32" cy="32" r="25" fill="none" stroke={accent} strokeWidth="1.2" />
      <text x="32" y="36" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="800" fontSize="15" fill={ink}>
        {initials}
      </text>
      <text x="32" y="46" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="5.5" letterSpacing="1" fill={accent}>
        ZANZIBAR
      </text>
    </svg>
  );
}
