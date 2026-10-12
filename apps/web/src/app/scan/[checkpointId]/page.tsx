'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../context/auth-context';
import { apiErrorMessage } from '../../../lib/api';
import { Alert, Spinner } from '../../../components/ui/primitives';
import { ScannerView } from '../../../features/scan/ScannerView';
import { checkpointsApi } from '../../../features/checkpoints/checkpoints-api';
import type { Checkpoint } from '../../../features/checkpoints/types';

export default function ScanCheckpointPage() {
  const params = useParams<{ checkpointId: string }>();
  const checkpointId = Number(params?.checkpointId);
  const { hasRole, isLoading: isAuthLoading } = useAuth();

  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(checkpointId) || checkpointId <= 0) {
      setError('El punto de control indicado no es válido.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Se resuelve sobre los puntos que el usuario puede operar: así el operador
      // no puede abrir por URL un punto que no tiene asignado.
      const available = await checkpointsApi.available();
      const found = available.find((item) => item.id === checkpointId);

      if (!found) {
        setError('Este punto de control no está disponible para su usuario o fue desactivado.');
        setCheckpoint(null);
      } else {
        setCheckpoint(found);
      }
    } catch (loadError) {
      setError(apiErrorMessage(loadError, 'No se pudo cargar el punto de control'));
    } finally {
      setLoading(false);
    }
  }, [checkpointId]);

  useEffect(() => {
    load();
  }, [load]);

  if (isAuthLoading || loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (error || !checkpoint) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
        <Alert variant="error">{error ?? 'Punto de control no disponible.'}</Alert>
        <Link href="/scan" className="inline-flex items-center gap-1 text-sm font-medium text-primary-700">
          <ArrowLeft className="w-4 h-4" />
          Volver a elegir punto
        </Link>
      </div>
    );
  }

  return <ScannerView checkpoint={checkpoint} canOverride={hasRole('admin')} />;
}
