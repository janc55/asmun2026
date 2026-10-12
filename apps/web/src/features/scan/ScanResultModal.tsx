'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { Button, Field, Input } from '../../components/ui/primitives';
import { formatCode } from './scan-api';
import { RESULT_TITLES, ScanOutcome } from './types';

const BACKGROUNDS: Record<string, string> = {
  verde: 'bg-status-ok',
  amarillo: 'bg-amber-600',
  rojo: 'bg-status-error',
};

const ICONS: Record<string, typeof CheckCircle2> = {
  verde: CheckCircle2,
  amarillo: AlertTriangle,
  rojo: XCircle,
};

export interface ScanResultModalProps {
  outcome: ScanOutcome;
  onDismiss: () => void;
  /** Solo `admin`: autoriza una excepción sobre el intento mostrado (RF-14). */
  onOverride?: (reason: string) => Promise<void>;
  /** Milisegundos en pantalla antes de cerrarse solo (SDD 9.2: 2 s). */
  autoDismissMs?: number;
}

export function ScanResultModal({ outcome, onDismiss, onOverride, autoDismissMs = 2000 }: ScanResultModalProps) {
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const Icon = ICONS[outcome.color] ?? XCircle;
  const background = BACKGROUNDS[outcome.color] ?? BACKGROUNDS.rojo;
  const participant = outcome.participant;

  useEffect(() => {
    if (overrideOpen) return;
    const timer = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [overrideOpen, autoDismissMs, onDismiss]);

  const handleOverride = async () => {
    if (!onOverride || reason.trim().length < 3) return;
    setBusy(true);
    try {
      await onOverride(reason.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col text-white ${background}`}
      onClick={() => {
        if (!overrideOpen) onDismiss();
      }}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8 gap-3 overflow-y-auto">
        <Icon className="w-24 h-24" strokeWidth={2.5} aria-hidden />

        <p className="text-sm font-semibold uppercase tracking-[0.2em] opacity-95">
          {RESULT_TITLES[outcome.result]}
        </p>

        {participant ? (
          <>
            <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight">{participant.name}</h2>
            <p className="text-lg font-medium opacity-95">
              {participant.roleLabel}
              {participant.school ? ` · ${participant.school}` : ''}
            </p>
            <p className="font-mono text-xl font-bold tracking-widest">{formatCode(participant.code)}</p>
            {participant.committee && (
              <p className="text-base opacity-95">
                {participant.committee}
                {participant.position ? ` · ${participant.position}` : ''}
              </p>
            )}
          </>
        ) : (
          <h2 className="text-3xl sm:text-4xl font-extrabold">Sin identificar</h2>
        )}

        <p className="mt-1 text-xl font-semibold max-w-2xl">{outcome.message}</p>

        {outcome.previous && (
          <p className="text-lg font-medium opacity-95">
            Registrado a las {outcome.previous.atLabel} por {outcome.previous.by}
          </p>
        )}

        {outcome.requirement && (
          <p className="text-lg font-medium opacity-95">Requisito pendiente: {outcome.requirement.name}</p>
        )}

        {outcome.exception && (
          <p className="text-base opacity-95 max-w-2xl">
            Motivo: {outcome.exception.reason}
            {outcome.exception.waived.length > 0 ? ` · Se autorizó: ${outcome.exception.waived.join('; ')}` : ''}
          </p>
        )}

        {outcome.dietaryAlert && outcome.dietaryNotes && (
          <div className="mt-3 w-full max-w-xl rounded-2xl bg-amber-200 px-5 py-4 text-left text-amber-950 shadow-lg">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
              <AlertTriangle className="w-4 h-4" />
              Restricciones alimentarias
            </p>
            <p className="mt-1 text-xl font-extrabold">{outcome.dietaryNotes}</p>
          </div>
        )}
      </div>

      <div className="bg-black/25 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-medium opacity-95">Toca la pantalla para continuar</p>

        {onOverride && !overrideOpen && !outcome.registered && (
          <Button
            type="button"
            variant="secondary"
            onClick={(event) => {
              event.stopPropagation();
              setOverrideOpen(true);
            }}
          >
            <ShieldAlert className="w-4 h-4" />
            Autorizar excepción
          </Button>
        )}
      </div>

      {overrideOpen && (
        <div
          className="absolute inset-x-0 bottom-0 bg-white text-gray-900 rounded-t-2xl p-5 space-y-3 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <Field
            label="Motivo de la excepción"
            required
            hint="Queda registrado en la auditoría junto con las reglas que se autorizaron."
          >
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ej. Llegó tarde, autorizado por coordinación"
              autoFocus
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOverrideOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={busy}
              disabled={reason.trim().length < 3}
              onClick={handleOverride}
            >
              <ShieldAlert className="w-4 h-4" />
              Autorizar excepción
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
