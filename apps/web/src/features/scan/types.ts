import type { Checkpoint } from '../checkpoints/types';

export type ScanResultValue =
  | 'ok'
  | 'duplicado'
  | 'fuera_de_horario'
  | 'falta_requisito'
  | 'no_habilitado'
  | 'no_encontrado'
  | 'excepcion'
  | 'anulado';

export type ScanColor = 'verde' | 'amarillo' | 'rojo';

export type ScanSource = 'qr' | 'manual' | 'busqueda';

export interface ScanParticipant {
  id: number;
  code: string;
  name: string;
  firstName: string;
  lastName: string;
  role: string;
  roleLabel: string;
  position: string | null;
  country: string | null;
  school: string | null;
  committee: string | null;
  committeeShort: string | null;
  dietaryNotes: string | null;
  isActive: boolean;
}

export interface ScanOutcome {
  id: string;
  result: ScanResultValue;
  color: ScanColor;
  message: string;
  registered: boolean;
  participant: ScanParticipant | null;
  checkpoint: Checkpoint;
  source: ScanSource;
  scannedAt: string;
  scannedAtLabel: string;
  previous: { scanId: string; at: string; atLabel: string; by: string } | null;
  requirement: { id: number; name: string } | null;
  window: { opensAt: string | null; closesAt: string | null } | null;
  exception: { reason: string; waived: string[] } | null;
  dietaryAlert: boolean;
  dietaryNotes: string | null;
}

export interface ScanSearchResult {
  id: number;
  code: string;
  name: string;
  firstName: string;
  lastName: string;
  role: string;
  roleLabel: string;
  school: string | null;
  committeeShort: string | null;
}

export const RESULT_TITLES: Record<ScanResultValue, string> = {
  ok: 'Registrado',
  excepcion: 'Excepción autorizada',
  duplicado: 'Ya estaba registrado',
  fuera_de_horario: 'Fuera de horario',
  falta_requisito: 'Falta un requisito',
  no_habilitado: 'No habilitado',
  no_encontrado: 'No encontrado',
  anulado: 'Anulado',
};
