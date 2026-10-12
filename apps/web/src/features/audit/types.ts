export interface AuditEvent {
  id: string;
  action: string;
  actionLabel: string;
  entity: string;
  entityId: string | null;
  reason: string | null;
  createdAt: string;
  dateLabel: string;
  timeLabel: string;
  createdAtLabel: string;
  user: { id: number; username: string; fullName: string; role: string } | null;
}

export interface AuditFilters {
  actions: Array<{ action: string; label: string; count: number }>;
  users: Array<{ id: number; fullName: string; username: string; role: string }>;
}

export interface AuditResponse {
  data: AuditEvent[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    filters: AuditFilters;
  };
}

export interface ScanHistoryItem {
  id: string;
  result: string;
  resultLabel: string;
  color: 'verde' | 'amarillo' | 'rojo';
  source: string;
  sourceLabel: string;
  scannedAt: string;
  dateLabel: string;
  timeLabel: string;
  note: string | null;
  participant: {
    id: number;
    code: string;
    name: string;
    role: string;
    roleLabel: string;
    school: string | null;
  } | null;
  checkpoint: { id: number; name: string; type: string; typeLabel: string; day: string; dayLabel: string };
  user: { id: number; fullName: string };
  voided: { by: string | null; reason: string | null } | null;
}

export interface ScanHistoryResponse {
  data: ScanHistoryItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export const SCAN_RESULT_OPTIONS = [
  { value: 'ok', label: 'Registrado' },
  { value: 'excepcion', label: 'Excepción autorizada' },
  { value: 'duplicado', label: 'Ya registrado (duplicado)' },
  { value: 'fuera_de_horario', label: 'Fuera de horario' },
  { value: 'falta_requisito', label: 'Falta requisito' },
  { value: 'no_habilitado', label: 'No habilitado' },
  { value: 'no_encontrado', label: 'No encontrado' },
  { value: 'anulado', label: 'Anulado' },
];

export function resultChipClasses(color: string): string {
  if (color === 'verde') return 'bg-green-50 text-green-700 border-green-200';
  if (color === 'amarillo') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}
