'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { QrCode, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/auth-context';
import { apiErrorMessage } from '../../lib/api';
import { todayInEventZone } from '../../lib/datetime';
import { Alert, Button, Spinner } from '../../components/ui/primitives';
import { CheckpointSelector } from '../../features/scan/CheckpointSelector';
import { checkpointsApi } from '../../features/checkpoints/checkpoints-api';
import type { Checkpoint } from '../../features/checkpoints/types';

export default function ScanPage() {
  const { user, isLoading: isAuthLoading, hasRole } = useAuth();
  const canScan = hasRole('admin', 'registrador', 'operador');

  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canScan) return;
    setLoading(true);
    setError(null);
    try {
      const response = await checkpointsApi.available();
      setCheckpoints(response);
    } catch (loadError) {
      setError(apiErrorMessage(loadError, 'No se pudieron cargar sus puntos de control'));
    } finally {
      setLoading(false);
    }
  }, [canScan]);

  useEffect(() => {
    load();
  }, [load]);

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (user && !canScan) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Alert variant="warning">
          Su rol ({user.role}) no registra escaneos. Use el panel de participantes o de reportes.
        </Alert>
      </div>
    );
  }

  const openCount = checkpoints.filter((checkpoint) => checkpoint.status.isOpen).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 tracking-tight">
            <QrCode className="w-6 h-6 text-primary-600" />
            Elegir punto de control
          </h1>
          <p className="text-sm text-gray-600">
            {hasRole('operador')
              ? `${checkpoints.length} punto(s) asignado(s) · ${openCount} abierto(s) ahora`
              : `${openCount} punto(s) abierto(s) de ${checkpoints.length} · ${todayInEventZone()}`}
          </p>
        </div>

        <Button type="button" variant="secondary" onClick={load} loading={loading}>
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </Button>
      </div>

      <CheckpointSelector checkpoints={checkpoints} loading={loading} error={error} onRefresh={load} />
    </div>
  );
}
