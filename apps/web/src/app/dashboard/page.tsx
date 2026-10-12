'use client';

import React from 'react';
import { useAuth } from '../../context/auth-context';
import { Alert, Spinner } from '../../components/ui/primitives';
import { DashboardView } from '../../features/dashboard/DashboardView';

export default function DashboardPage() {
  const { user, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (user && !hasRole('admin', 'lector')) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Alert variant="warning">
          Su rol ({user.role}) no tiene acceso al panel. Use la pantalla de escaneo.
        </Alert>
      </div>
    );
  }

  // El rol lector consulta y descarga reportes (matriz del Plan de Acción).
  return <DashboardView canExport={hasRole('admin', 'lector')} />;
}
