import { useEffect, useState } from 'react';
import { api, apiUrl } from '../api/client.js';

let cached = null;
let pending = null;
const listeners = new Set();

function withLogo(data) {
  return data ? { ...data, logoSrc: data.hasLogo ? apiUrl(`/school/logo?v=${data.logoVersion}`) : null } : data;
}

/** Use the uploaded school logo as the browser tab icon (falls back to the bundled shield). */
function applyFavicon(logoSrc) {
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  if (logoSrc) {
    link.removeAttribute('type');
    link.href = logoSrc;
  } else {
    link.type = 'image/svg+xml';
    link.href = '/favicon.svg';
  }
  let apple = document.querySelector('link[rel="apple-touch-icon"]');
  if (logoSrc) {
    if (!apple) {
      apple = document.createElement('link');
      apple.rel = 'apple-touch-icon';
      document.head.appendChild(apple);
    }
    apple.href = logoSrc;
  } else if (apple) {
    apple.remove();
  }
}

function load() {
  pending = pending || api.get('/school')
    .then((data) => {
      cached = withLogo(data);
      applyFavicon(cached?.logoSrc ?? null);
      listeners.forEach((listener) => listener(cached));
      return cached;
    })
    .catch(() => null)
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Re-fetch the school identity after School Settings changes and update every subscriber. */
export function refreshSchoolProfile() {
  return load();
}

/** Public school identity (name, motto, contacts, logo), shared across the app. */
export function useSchoolProfile() {
  const [school, setSchool] = useState(cached);

  useEffect(() => {
    listeners.add(setSchool);
    if (!cached) load();
    return () => {
      listeners.delete(setSchool);
    };
  }, []);

  return school;
}
