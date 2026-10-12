'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, CalendarClock, CheckCircle2, ChevronRight, Clock, PowerOff } from 'lucide-react';
import { Alert, Card, Spinner } from '../../components/ui/primitives';
import { checkpointTypeLabel, Checkpoint, CheckpointStatusLabel } from '../checkpoints/types';

const STATUS_CHIP: Record<CheckpointStatusLabel, string> = {
  abierto: 'bg-green-50 text-green-700 border-green-200',
  programado: 'bg-blue-50 text-blue-700 border-blue-200',
  finalizado: 'bg-gray-100 text-gray-600 border-gray-300',
  desactivado: 'bg-amber-50 text-amber-700 border-amber-200',
};

export interface CheckpointSelectorProps {
  checkpoints: Checkpoint[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function CheckpointSelector({ checkpoints, loading, error, onRefresh }: CheckpointSelectorProps) {
  const groups = [
    {
      key: 'abiertos',
      title: 'Abiertos ahora',
      icon: CheckCircle2,
      items: checkpoints.filter((checkpoint) => checkpoint.status.isOpen),
    },
    {
      key: 'hoy',
      title: 'Programados para hoy',
      icon: Clock,
      items: checkpoints.filter(
        (checkpoint) => !checkpoint.status.isOpen && checkpoint.status.label === 'programado' && checkpoint.status.isToday,
      ),
    },
    {
      key: 'otros',
      title: 'Otros días',
      icon: CalendarClock,
      items: checkpoints.filter(
        (checkpoint) => !checkpoint.status.isOpen && checkpoint.status.label === 'programado' && !checkpoint.status.isToday,
      ),
    },
    {
      key: 'finalizados',
      title: 'Finalizados',
      icon: Clock,
      items: checkpoints.filter((checkpoint) => checkpoint.status.label === 'finalizado'),
    },
    {
      key: 'desactivados',
      title: 'Desactivados',
      icon: PowerOff,
      items: checkpoints.filter((checkpoint) => checkpoint.status.label === 'desactivado'),
    },
  ].filter((group) => group.items.length > 0);

  if (loading && checkpoints.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-500">
        <Spinner className="w-5 h-5" /> Cargando sus puntos de control…
      </div>
    );
  }

  if (checkpoints.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-gray-900">No tiene puntos de control disponibles</h2>
            <p className="mt-1 text-sm text-gray-600">
              Si es operador, pida a la organización que le asigne los puntos de puerta o comedor. Si es
              administrador, cree los puntos del evento en la sección «Puntos de control» y verifique que el
              día corresponda a hoy.
            </p>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-3 text-sm font-medium text-primary-700 underline"
            >
              Volver a intentar
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      {groups.map((group) => {
        const Icon = group.icon;
        return (
          <section key={group.key} className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
              <Icon className="w-4 h-4" />
              {group.title}
              <span className="text-gray-400">({group.items.length})</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {group.items.map((checkpoint) => {
                const disabled = checkpoint.status.label === 'desactivado';

                const content = (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-bold text-gray-900 truncate">{checkpoint.name}</div>
                      <div className="mt-0.5 text-sm text-gray-600">
                        {checkpointTypeLabel(checkpoint.type)} · {checkpoint.windowLabel}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">{checkpoint.status.message}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border uppercase tracking-wide ${STATUS_CHIP[checkpoint.status.label]}`}
                      >
                        {checkpoint.status.label}
                      </span>
                      {!disabled && <ChevronRight className="w-5 h-5 text-gray-400" />}
                    </div>
                  </>
                );

                const className = `flex items-center gap-4 w-full text-left rounded-2xl border p-4 min-h-[92px] transition-colors ${
                  disabled
                    ? 'border-gray-200 bg-gray-50 opacity-70 cursor-not-allowed'
                    : 'border-gray-200 bg-white hover:border-primary-300 hover:shadow-md active:bg-primary-50'
                }`;

                return disabled ? (
                  <div key={checkpoint.id} className={className} aria-disabled="true">
                    {content}
                  </div>
                ) : (
                  <Link key={checkpoint.id} href={`/scan/${checkpoint.id}`} className={className}>
                    {content}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      <button type="button" onClick={onRefresh} className="text-sm font-medium text-primary-700 underline">
        Actualizar estado de los puntos
      </button>
    </div>
  );
}
