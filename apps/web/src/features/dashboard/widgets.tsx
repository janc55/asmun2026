'use client';

import React from 'react';
import { cn } from '../../lib/cn';
import type { TypeProgress } from './types';

export function ProgressBar({
  value,
  tone = 'primary',
  className,
}: {
  value: number;
  tone?: 'primary' | 'ok' | 'warning' | 'error';
  className?: string;
}) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  const toneClass = {
    primary: 'bg-primary-600',
    ok: 'bg-status-ok',
    warning: 'bg-status-warning',
    error: 'bg-status-error',
  }[tone];

  return (
    <div
      className={cn('w-full h-2 rounded-full bg-gray-200 overflow-hidden', className)}
      role="progressbar"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn('h-full rounded-full transition-all', toneClass)} style={{ width: `${safe}%` }} />
    </div>
  );
}

function toneForPercentage(percentage: number): 'ok' | 'warning' | 'error' {
  if (percentage >= 90) return 'ok';
  if (percentage >= 50) return 'warning';
  return 'error';
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'primary',
  progress,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: 'primary' | 'ok' | 'warning' | 'error' | 'neutral';
  progress?: number;
}) {
  const valueTone = {
    primary: 'text-primary-700',
    ok: 'text-status-ok',
    warning: 'text-status-warning',
    error: 'text-status-error',
    neutral: 'text-gray-900',
  }[tone];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-gray-400" />}
      </div>
      <div className={cn('mt-1 text-2xl font-bold', valueTone)}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-gray-500">{hint}</div>}
      {progress !== undefined && <ProgressBar value={progress} tone={toneForPercentage(progress)} className="mt-2" />}
    </div>
  );
}

/** Tarjeta de avance por tipo de punto (ingreso, credencial, refrigerio…). */
export function TypeCard({ item }: { item: TypeProgress }) {
  const tone = toneForPercentage(item.percentage);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">{item.label}</span>
        <span
          className={cn(
            'text-xs font-semibold',
            tone === 'ok' ? 'text-status-ok' : tone === 'warning' ? 'text-status-warning' : 'text-status-error',
          )}
        >
          {item.percentage}%
        </span>
      </div>

      <div className="mt-1 text-xl font-bold text-gray-900">
        {item.registered}
        <span className="text-sm font-medium text-gray-500"> / {item.expected}</span>
      </div>
      <ProgressBar value={item.percentage} tone={tone} className="mt-2" />
      <div className="mt-1 text-xs text-gray-500">
        {item.pending > 0 ? `Faltan ${item.pending}` : 'Completo'}
      </div>
    </div>
  );
}
