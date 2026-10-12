import { CheckpointType, ScanResult } from '@prisma/client';

/** Resultados que ocupan el punto de control (índice parcial `ux_scan_once`). */
export const VALID_SCAN_RESULTS: ScanResult[] = [ScanResult.ok, ScanResult.excepcion];

/** Intentos rechazados por el motor de validación (SDD 9.1). */
export const REJECTED_SCAN_RESULTS: ScanResult[] = [
  ScanResult.duplicado,
  ScanResult.fuera_de_horario,
  ScanResult.falta_requisito,
  ScanResult.no_habilitado,
  ScanResult.no_encontrado,
];

/** Etiquetas en español del resultado del escaneo (SDD 9.2). */
export const SCAN_RESULT_LABELS: Record<ScanResult, string> = {
  ok: 'Registrado',
  excepcion: 'Excepción autorizada',
  duplicado: 'Ya registrado',
  fuera_de_horario: 'Fuera de horario',
  falta_requisito: 'Falta requisito',
  no_habilitado: 'No habilitado',
  no_encontrado: 'No encontrado',
  anulado: 'Anulado',
};

export const SCAN_SOURCE_LABELS: Record<string, string> = {
  qr: 'QR',
  manual: 'Código manual',
  busqueda: 'Búsqueda por nombre',
};

/** Etiquetas en español del tipo de punto de control. */
export const CHECKPOINT_TYPE_LABELS: Record<CheckpointType, string> = {
  ingreso: 'Ingreso',
  credencial: 'Credencial',
  material: 'Material',
  refrigerio: 'Refrigerio',
  almuerzo: 'Almuerzo',
  otro: 'Otro',
};

/** Etiquetas en español de las acciones auditadas. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  excepcion: 'Excepción autorizada',
  anular_scan: 'Escaneo anulado',
  reimpresion: 'Reimpresión de credencial',
};

export function scanResultLabel(result: string): string {
  return SCAN_RESULT_LABELS[result as ScanResult] ?? result;
}

export function checkpointTypeLabel(type: string): string {
  return CHECKPOINT_TYPE_LABELS[type as CheckpointType] ?? type;
}

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
