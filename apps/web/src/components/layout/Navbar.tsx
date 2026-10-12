'use client';

import React, { useState } from 'react';
import Link from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
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

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'registrador':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'operador':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'lector':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-700 to-primary-500 text-white font-bold text-lg shadow-md">
              A
            </div>
            <div>
              <span className="text-lg font-bold text-gray-900 tracking-tight">ASMUN</span>
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full font-medium bg-primary-50 text-primary-700 border border-primary-100">
                Control
              </span>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <div className="hidden md:flex items-center space-x-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-semibold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
                </a>
              );
            })}
          </div>

          {/* User profile & Logout */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900 leading-tight">
                {user.fullName}
              </div>
              <span
                className={`inline-block text-[11px] px-2 py-0.5 mt-0.5 rounded-full font-medium border uppercase tracking-wider ${getRoleBadgeColor(
                  user.role,
                )}`}
              >
                {user.role}
              </span>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 pt-2 pb-4 space-y-1">
          <div className="px-3 py-2 border-b border-gray-100 mb-2">
            <div className="font-semibold text-gray-900">{user.fullName}</div>
            <span
              className={`inline-block text-[11px] px-2 py-0.5 mt-1 rounded-full font-medium border uppercase tracking-wider ${getRoleBadgeColor(
                user.role,
              )}`}
            >
              {user.role}
            </span>
          </div>

          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center px-3 py-2.5 rounded-lg text-base font-medium ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </a>
            );
          })}

          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              logout();
            }}
            className="w-full flex items-center px-3 py-2.5 text-base font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-2"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Cerrar sesión
          </button>
        </div>
      )}
    </nav>
  );
}
