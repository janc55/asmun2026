import type { ParticipantRole } from './types';

/** Colores por rol del SDD 10.2 (chips de la interfaz; la credencial usa el azul del fondo). */
export const ROLE_OPTIONS: Array<{ value: ParticipantRole; label: string; color: string }> = [
  { value: 'delegado', label: 'Delegado', color: '#1D4ED8' },
  { value: 'docente', label: 'Docente', color: '#0F766E' },
  { value: 'mesa', label: 'Mesa Directiva', color: '#7C2D12' },
  { value: 'secretaria', label: 'Secretaría', color: '#6D28D9' },
  { value: 'staff', label: 'Staff', color: '#111827' },
  { value: 'invitado', label: 'Invitado', color: '#B45309' },
];

const ROLE_BADGE_CLASSES: Record<string, string> = {
  delegado: 'bg-blue-50 text-blue-700 border-blue-200',
  docente: 'bg-teal-50 text-teal-700 border-teal-200',
  mesa: 'bg-orange-50 text-orange-800 border-orange-200',
  secretaria: 'bg-violet-50 text-violet-700 border-violet-200',
  staff: 'bg-gray-100 text-gray-800 border-gray-300',
  invitado: 'bg-amber-50 text-amber-700 border-amber-200',
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return '—';
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}

export function roleBadgeClasses(role: string | null | undefined): string {
  return ROLE_BADGE_CLASSES[role ?? ''] ?? 'bg-gray-100 text-gray-700 border-gray-200';
}

export function roleColor(role: string | null | undefined): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.color ?? '#4B5563';
}

/** Presentación cosmética del código corto: `K7P3Q9` → `K7P-3Q9`. */
export function formatShortCode(code: string | null | undefined): string {
  if (!code) return '—';
  const clean = code.trim().toUpperCase();
  return clean.length === 6 ? `${clean.slice(0, 3)}-${clean.slice(3)}` : clean;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
