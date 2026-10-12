'use client';

import React from 'react';
import { useAuth } from '../../context/auth-context';
import { Alert, Spinner } from '../../components/ui/primitives';
import { AuditView } from '../../features/audit/AuditView';

export default function AuditPage() {
  const { user, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (user && !hasRole('admin')) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Alert variant="warning">
          La auditoría está disponible solo para administradores.
        </Alert>
      </div>
    );
  }

  return <AuditView />;
}
