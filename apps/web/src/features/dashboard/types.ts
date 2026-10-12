export interface CheckpointStatusView {
  isToday: boolean;
  isOpen: boolean;
  label: 'abierto' | 'programado' | 'finalizado' | 'desactivado';
  message: string;
}

export interface CheckpointProgress {
  id: number;
  name: string;
  type: string;
  typeLabel: string;
  day: string;
  dayLabel: string;
  windowLabel: string;
  status: CheckpointStatusView;
  expected: number;
  registered: number;
  pending: number;
  percentage: number;
  exceptions: number;
  voided: number;
  rejected: number;
  duplicates: number;
  lastScanAt: string | null;
  lastScanAtLabel: string | null;
  byRole: Array<{ role: string; label: string; expected: number; registered: number }>;
  bySchool: Array<{ schoolId: number | null; school: string; expected: number; registered: number; pending: number }>;
}

export interface TypeProgress {
  type: string;
  label: string;
  expected: number;
  registered: number;
  pending: number;
  percentage: number;
}

export interface SchoolProgress {
  schoolId: number | null;
  school: string;
  expected: number;
  registered: number;
  pending: number;
  percentage: number;
}

export interface DashboardSummary {
  generatedAt: string;
  generatedAtLabel: string;
  event: { name: string; timezone: string; today: string; days: string[] };
  totals: {
    activeParticipants: number;
    attendedParticipants: number;
    attendancePercentage: number;
    checkpoints: number;
    openCheckpoints: number;
    validScans: number;
    exceptions: number;
    rejectedScans: number;
    voidedScans: number;
    byResult: Array<{ result: string; label: string; count: number }>;
  };
  checkpoints: CheckpointProgress[];
  byType: TypeProgress[];
  bySchool: SchoolProgress[];
}

export interface PendingParticipant {
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
}

export interface PendingResponse {
  checkpoint: CheckpointProgress;
  data: PendingParticipant[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

/** Tipos de punto destacados en las tarjetas de KPI (orden del SDD 10.4). */
export const KPI_TYPE_ORDER = ['ingreso', 'credencial', 'material', 'refrigerio', 'almuerzo', 'otro'];
