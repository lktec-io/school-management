import { useState } from 'react';
import { apiUrl } from '../../api/client.js';

function initialsOf(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?';
}

/**
 * Student photo served by the API (session cookie required), falling back to initials when
 * there is no photo or it fails to load. `photoUrl` is API-relative, e.g. /students/12/photo?v=…
 */
export default function StudentAvatar({ name, photoUrl, size = 'md', className = '' }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const showPhoto = photoUrl && failedUrl !== photoUrl;
  return (
    <span className={`avatar avatar--${size} ${className}`} aria-hidden="true">
      {showPhoto
        ? <img src={apiUrl(photoUrl)} alt="" loading="lazy" decoding="async" onError={() => setFailedUrl(photoUrl)} />
        : <span className="avatar__initials">{initialsOf(name)}</span>}
    </span>
  );
}
