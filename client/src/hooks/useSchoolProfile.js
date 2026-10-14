import { useEffect, useState } from 'react';
import { api, apiUrl } from '../api/client.js';

let cached = null;
let pending = null;
const listeners = new Set();

function withLogo(data) {
  return data ? { ...data, logoSrc: data.hasLogo ? apiUrl(`/school/logo?v=${data.logoVersion}`) : null } : data;
}

function load() {
  pending = pending || api.get('/school')
    .then((data) => {
      cached = withLogo(data);
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
