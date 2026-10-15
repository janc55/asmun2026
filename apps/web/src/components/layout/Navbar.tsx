'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { BrandLogo } from '../ui/BrandLogo';
import {
  QrCode,
  Users,
  LayoutDashboard,
  CheckCircle,
  FileSpreadsheet,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

/** Punto de color por rol dentro de la barra oscura (mismo código que las fichas). */
const ROLE_DOT: Record<string, string> = {
  admin: 'bg-violet-400',
  registrador: 'bg-sky-400',
  operador: 'bg-emerald-400',
  lector: 'bg-amber-400',
};

export function Navbar() {
  const { user, logout, hasRole } = useAuth();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!user || pathname === '/login') {
    return null;
  }

  const navItems = [
    {
      label: 'Panel',
      href: '/dashboard',
      icon: LayoutDashboard,
      show: hasRole('admin', 'lector'),
    },
    {
      label: 'Participantes',
      href: '/participants',
      icon: Users,
      show: hasRole('admin', 'registrador', 'lector'),
    },
    {
      label: 'Escanear',
      href: '/scan',
      icon: QrCode,
      show: hasRole('admin', 'operador', 'registrador'),
    },
    {
      label: 'Puntos de Control',
      href: '/checkpoints',
      icon: CheckCircle,
      show: hasRole('admin', 'lector'),
    },
    {
      label: 'Reportes',
      href: '/reports',
      icon: FileSpreadsheet,
      show: hasRole('admin', 'lector'),
    },
    {
      label: 'Auditoría',
      href: '/audit',
      icon: ShieldCheck,
      show: hasRole('admin'),
    },
  ];

  const filteredNavItems = navItems.filter((item) => item.show);
  const rolePill = (extra = '') => (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-medium bg-white/10 text-white border border-white/20 uppercase tracking-wider ${extra}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${ROLE_DOT[user.role] ?? 'bg-white/70'}`} />
      {user.role}
    </span>
  );

  return (
    <nav className="sticky top-0 z-40 bg-primary-600 border-b border-white/10 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo y nombre del sistema */}
          <Link href="/dashboard" className="flex items-center gap-3 shrink-0">
            {/* Placa blanca: el logo del colegio puede ser oscuro y la barra es azul. */}
            <span className="inline-flex items-center justify-center bg-white rounded-lg px-1.5 py-1 shadow-sm">
              <BrandLogo size="sm" imageClassName="h-7" />
            </span>
            <span className="flex items-center gap-2">
              <span className="text-lg font-bold text-white tracking-tight">ASMUN</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/10 text-white border border-white/20">
                Control
              </span>
            </span>
          </Link>

          {/* Navegación de escritorio */}
          <div className="hidden md:flex items-center space-x-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-white text-primary-700 font-semibold shadow-sm'
                      : 'text-white/75 font-medium hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Usuario y cierre de sesión */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm font-semibold text-white leading-tight">{user.fullName}</div>
              {rolePill('mt-0.5')}
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="p-2 text-white/75 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Botón de menú móvil */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Menú"
              className="p-2 rounded-md text-white/80 hover:text-white hover:bg-white/10"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Menú móvil */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-primary-700 px-4 pt-2 pb-4 space-y-1">
          <div className="px-3 py-2 border-b border-white/10 mb-2">
            <div className="font-semibold text-white">{user.fullName}</div>
            {rolePill('mt-1')}
          </div>

          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center px-3 py-2.5 rounded-lg text-base ${
                  isActive
                    ? 'bg-white text-primary-700 font-semibold'
                    : 'text-white/80 font-medium hover:bg-white/10'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </Link>
            );
          })}

          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              logout();
            }}
            className="w-full flex items-center px-3 py-2.5 text-base font-medium text-red-200 hover:bg-white/10 rounded-lg transition-colors mt-2"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Cerrar sesión
          </button>
        </div>
      )}
    </nav>
  );
}
