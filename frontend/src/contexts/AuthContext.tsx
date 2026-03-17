import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

const AUTH_KEY = 'radar_auth';

type AuthContextType = {
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!sessionStorage.getItem(AUTH_KEY));

  const login = useCallback(async (username: string, password: string) => {
    const auth = btoa(`${username}:${password}`);
    try {
      const res = await fetch('/api/config', {
        headers: { 'Authorization': `Basic ${auth}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { ok: false, error: err.detail || 'Invalid credentials' };
      }
      sessionStorage.setItem(AUTH_KEY, auth);
      setIsLoggedIn(true);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'Network error' };
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_KEY);
    setIsLoggedIn(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
