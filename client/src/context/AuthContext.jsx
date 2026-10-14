import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous

  // The session cookie is HttpOnly, so the only way to know if we're signed in is to ask the API.
  useEffect(() => {
    let active = true;
    api.get('/auth/me')
      .then((data) => {
        if (!active) return;
        setUser(data.user);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setStatus('anonymous');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      setStatus('anonymous');
    };
    const handlePasswordRequired = () => {
      setUser((current) => (current ? { ...current, mustChangePassword: true } : current));
    };
    window.addEventListener('auth:expired', handleExpired);
    window.addEventListener('auth:password-change-required', handlePasswordRequired);
    return () => {
      window.removeEventListener('auth:expired', handleExpired);
      window.removeEventListener('auth:password-change-required', handlePasswordRequired);
    };
  }, []);

  const login = useCallback(async (identifier, password) => {
    const data = await api.post('/auth/login', { identifier, password });
    setUser(data.user);
    setStatus('authenticated');
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // The session may already be gone; the local state is cleared either way.
    } finally {
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const changePassword = useCallback(async (payload) => {
    const data = await api.post('/auth/change-password', payload);
    setUser(data.user);
    return data.user;
  }, []);

  const hasRole = useCallback((...roles) => Boolean(user && roles.flat().includes(user.role)), [user]);

  const value = useMemo(
    () => ({ user, status, login, logout, changePassword, hasRole }),
    [user, status, login, logout, changePassword, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
