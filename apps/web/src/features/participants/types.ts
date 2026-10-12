export type ParticipantRole = 'delegado' | 'docente' | 'mesa' | 'secretaria' | 'staff' | 'invitado';

export interface School {
  id: number;
  name: string;
  city: string | null;
  participantsCount: number;
}

export interface Committee {
  id: number;
  name: string;
  shortName: string | null;
  participantsCount: number;
}

export interface Participant {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  documentId: string | null;
  role: ParticipantRole;
  position: string | null;
  country: string | null;
  dietaryNotes: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  school: { id: number; name: string; city?: string | null } | null;
  committee: { id: number; name: string; shortName: string | null } | null;
}

export interface ScanHistoryItem {
  id: string;
  result: string;
  source: string;
  scannedAt: string;
  note: string | null;
  checkpoint: { id: number; name: string; type: string; day: string };
  user: { id: number; fullName: string };
}

export interface ParticipantDetail extends Participant {
  scans: ScanHistoryItem[];
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ParticipantInput {
  firstName: string;
  lastName: string;
  role: ParticipantRole;
  documentId?: string;
  position?: string;
  schoolId?: number | null;
  committeeId?: number | null;
  country?: string;
  dietaryNotes?: string;
  notes?: string;
  isActive?: boolean;
}

export interface ImportRowResult {
  row: number;
  status: 'ok' | 'error';
  errors: string[];
  warnings: string[];
  participantId?: number;
  code?: string;
  data: {
    firstName: string;
    lastName: string;
    role: ParticipantRole | null;
    school: string | null;
    committee: string | null;
    country: string | null;
    position: string | null;
    documentId: string | null;
    dietaryNotes: string | null;
    notes: string | null;
  };
}

export interface ImportReport {
  mode: 'preview' | 'confirmed';
  fileName: string;
  sheetName: string;
  headerRow: number;
  detectedColumns: Array<{ field: string; label: string; header: string }>;
  unknownColumns: string[];
  duplicatedColumns: Array<{ field: string; header: string }>;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    created: number;
    failed: number;
    schoolsToCreate: string[];
    committeesToCreate: string[];
    possibleDuplicates: number;
    appliedDefaultRole: ParticipantRole | null;
    appliedDefaultSchool: string | null;
  };
  rows: ImportRowResult[];
}
