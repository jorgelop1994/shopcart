import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AuthSession, AuthUser } from '../types/api.types';
import { authApi } from '../api/auth.api';
import { getStoredSession, setStoredSession } from '../api/httpClient';

interface AuthContextValue {
  user: AuthUser | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (correo: string, password: string) => Promise<AuthSession>;
  register: (data: {
    nombreCompleto: string;
    correo: string;
    password: string;
    telefono?: string;
  }) => Promise<AuthSession>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  useEffect(() => {
    const handleStorageChange = (event: Event) => {
      const customEvent = event as CustomEvent<AuthSession | null>;
      setSession(customEvent.detail ?? getStoredSession());
    };

    window.addEventListener('shopcart:auth-changed', handleStorageChange);
    return () => {
      window.removeEventListener('shopcart:auth-changed', handleStorageChange);
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    const stored = getStoredSession();
    if (!stored?.accessToken) {
      setIsInitializing(false);
      return;
    }
    try {
      const profile = await authApi.getMe();
      const latest = getStoredSession();
      if (latest) {
        const updated: AuthSession = { ...latest, user: profile };
        setStoredSession(updated);
        setSession(updated);
      }
    } catch {
      setStoredSession(null);
      setSession(null);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const login = useCallback(async (correo: string, password: string): Promise<AuthSession> => {
    const newSession = await authApi.login(correo, password);
    setSession(newSession);
    return newSession;
  }, []);

  const register = useCallback(
    async (data: {
      nombreCompleto: string;
      correo: string;
      password: string;
      telefono?: string;
    }): Promise<AuthSession> => {
      const newSession = await authApi.register(data);
      setSession(newSession);
      return newSession;
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    await authApi.logout();
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        isAuthenticated: Boolean(session?.user),
        isInitializing,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe utilizarse dentro de un AuthProvider');
  }
  return ctx;
}
