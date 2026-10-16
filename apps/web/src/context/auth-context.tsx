'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, AUTH_TOKEN_KEYS, SESSION_EXPIRED_EVENT } from '../lib/api';

export type UserRole = 'admin' | 'registrador' | 'operador' | 'lector';

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  assignedCheckpoints?: Array<{
    id: number;
    name: string;
    type: string;
    day: string;
  }>;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const loadCurrentUser = useCallback(async () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEYS.access);
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const userData = await api.get<User>('/auth/me');
      setUser(userData);
    } catch {
      localStorage.removeItem(AUTH_TOKEN_KEYS.access);
      localStorage.removeItem(AUTH_TOKEN_KEYS.refresh);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  // El cliente de API ya intentó renovar el token con el refresh token y no
  // pudo (caducó, el usuario fue desactivado…): se cierra la sesión una sola vez.
  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      router.push('/login');
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, [router]);

  // Protección de rutas en cliente
  useEffect(() => {
    if (isLoading) return;

    const isAuthRoute = pathname === '/login';

    if (!user && !isAuthRoute) {
      router.push('/login');
    } else if (user && isAuthRoute) {
      // Redirección inteligente según el rol
      if (user.role === 'operador') {
        router.push('/scan');
      } else if (user.role === 'registrador') {
        router.push('/participants');
      } else {
        router.push('/dashboard');
      }
    }
  }, [user, isLoading, pathname, router]);

  const login = async (username: string, password: string) => {
    const response = await api.post<{
      accessToken: string;
      refreshToken: string;
      user: User;
    }>('/auth/login', { username, password });

    localStorage.setItem(AUTH_TOKEN_KEYS.access, response.accessToken);
    localStorage.setItem(AUTH_TOKEN_KEYS.refresh, response.refreshToken);

    // Cargar perfil completo con checkpoints
    try {
      const profile = await api.get<User>('/auth/me');
      setUser(profile);
    } catch {
      setUser(response.user);
    }

    if (response.user.role === 'operador') {
      router.push('/scan');
    } else if (response.user.role === 'registrador') {
      router.push('/participants');
    } else {
      router.push('/dashboard');
    }
  };

  const logout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEYS.access);
    localStorage.removeItem(AUTH_TOKEN_KEYS.refresh);
    setUser(null);
    router.push('/login');
  };

  const hasRole = (...roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
