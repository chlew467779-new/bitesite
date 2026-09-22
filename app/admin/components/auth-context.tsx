/* bitesite/app/admin/components/auth-context.tsx */
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'admin_session';
const TOKEN_KEY = 'admin_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setExpiresAt(null);
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    // Check existing session on mount
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedToken = localStorage.getItem(TOKEN_KEY);
    
    if (stored && storedToken) {
      try {
        const session = JSON.parse(stored);
        const expiry = Date.parse(session.expiresAt);
        if (Number.isFinite(expiry) && expiry > Date.now()) {
          setIsAuthenticated(true);
          setToken(storedToken);
          setExpiresAt(expiry);
        } else {
          clearSession();
        }
      } catch {
        clearSession();
      }
    }
    setIsLoading(false);
  }, [clearSession]);

  useEffect(() => {
    if (!expiresAt) return;

    const expireIfNeeded = () => {
      if (Date.now() >= expiresAt) clearSession();
    };
    const timeout = window.setTimeout(expireIfNeeded, Math.max(0, expiresAt - Date.now()));
    window.addEventListener('focus', expireIfNeeded);
    document.addEventListener('visibilitychange', expireIfNeeded);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('focus', expireIfNeeded);
      document.removeEventListener('visibilitychange', expireIfNeeded);
    };
  }, [clearSession, expiresAt]);

  const login = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }

      // Store session
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        expiresAt: data.expiresAt,
        loggedInAt: new Date().toISOString(),
      }));

      setToken(data.token);
      setExpiresAt(Date.parse(data.expiresAt));
      setIsAuthenticated(true);
      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout, token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
