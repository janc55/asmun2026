'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, ApiError } from '../lib/api';

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
    const token = localStorage.getItem('asmun_access_token');
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const userData = await api.get<User>('/auth/me');
      setUser(userData);
    } catch {
      localStorage.removeItem('asmun_access_token');
      localStorage.removeItem('asmun_refresh_token');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

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

    localStorage.setItem('asmun_access_token', response.accessToken);
    localStorage.setItem('asmun_refresh_token', response.refreshToken);

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
    localStorage.removeItem('asmun_access_token');
    localStorage.removeItem('asmun_refresh_token');
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
