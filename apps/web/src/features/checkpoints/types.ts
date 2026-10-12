export type CheckpointType =
  | 'ingreso'
  | 'credencial'
  | 'material'
  | 'refrigerio'
  | 'almuerzo'
  | 'otro';

export type CheckpointStatusLabel = 'abierto' | 'programado' | 'finalizado' | 'desactivado';

export interface CheckpointStatus {
  isToday: boolean;
  isOpen: boolean;
  label: CheckpointStatusLabel;
  message: string;
}

export interface Checkpoint {
  id: number;
  name: string;
  type: CheckpointType;
  /** `YYYY-MM-DD` */
  day: string;
  dayLabel: string;
  startsAt: string | null;
  endsAt: string | null;
  windowLabel: string;
  requiresCheckpointId: number | null;
  requiresCheckpoint: { id: number; name: string; type: CheckpointType } | null;
  appliesToRoles: string[] | null;
  isActive: boolean;
  scansCount: number;
  operatorsCount: number;
  status: CheckpointStatus;
}

export interface CheckpointInput {
  name: string;
  type: CheckpointType;
  day: string;
  startsAt?: string | null;
  endsAt?: string | null;
  requiresCheckpointId?: number | null;
  appliesToRoles?: string[] | null;
  isActive?: boolean;
}

export const CHECKPOINT_TYPE_OPTIONS: Array<{ value: CheckpointType; label: string }> = [
  { value: 'ingreso', label: 'Ingreso' },
  { value: 'credencial', label: 'Credencial' },
  { value: 'material', label: 'Material' },
  { value: 'refrigerio', label: 'Refrigerio' },
  { value: 'almuerzo', label: 'Almuerzo' },
  { value: 'otro', label: 'Otro' },
];

export function checkpointTypeLabel(type: string | null | undefined): string {
  return CHECKPOINT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? String(type ?? '—');
}
