import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const AcademicContext = createContext(null);

const EMPTY_PERIOD = { academicYear: null, term: null };

/** Current academic year/term, shared by the top bar badge and academic screens. */
export function AcademicProvider({ children }) {
  const { status, user } = useAuth();
  const [period, setPeriod] = useState(EMPTY_PERIOD);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setPeriod(await api.get('/academics/current'));
    } catch {
      setPeriod(EMPTY_PERIOD);
    } finally {
      setLoaded(true);
    }
  }, []);

  const ready = status === 'authenticated' && user && !user.mustChangePassword;
  useEffect(() => {
    if (!ready) return undefined;
    let active = true;
    api.get('/academics/current')
      .then((data) => active && setPeriod(data))
      .catch(() => active && setPeriod(EMPTY_PERIOD))
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [ready]);

  const value = useMemo(() => ({ ...period, loaded, refresh }), [period, loaded, refresh]);
  return <AcademicContext.Provider value={value}>{children}</AcademicContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAcademicPeriod() {
  const context = useContext(AcademicContext);
  if (!context) throw new Error('useAcademicPeriod must be used within an AcademicProvider');
  return context;
}
