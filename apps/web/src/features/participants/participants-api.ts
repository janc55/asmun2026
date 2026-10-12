import { api } from '../../lib/api';
import type {
  Committee,
  ImportReport,
  Paginated,
  Participant,
  ParticipantDetail,
  ParticipantInput,
  School,
} from './types';

export interface ParticipantFilters {
  search?: string;
  schoolId?: number | '';
  committeeId?: number | '';
  role?: string;
  isActive?: boolean | '';
  page?: number;
  limit?: number;
}

export interface BadgeBatchPayload {
  participantIds?: number[];
  search?: string;
  schoolId?: number;
  committeeId?: number;
  role?: string;
  isActive?: boolean;
  format?: 'card' | 'a4';
  reason?: string;
}

/** Arma el query string omitiendo valores vacíos. */
function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const participantsApi = {
  list(filters: ParticipantFilters): Promise<Paginated<Participant>> {
    return api.get<Paginated<Participant>>(
      `/participants${toQuery({
        search: filters.search,
        schoolId: filters.schoolId,
        committeeId: filters.committeeId,
        role: filters.role,
        isActive: filters.isActive,
        page: filters.page,
        limit: filters.limit ?? 25,
      })}`,
    );
  },

  detail(id: number): Promise<ParticipantDetail> {
    return api.get<ParticipantDetail>(`/participants/${id}`);
  },

  create(payload: ParticipantInput): Promise<Participant> {
    return api.post<Participant>('/participants', payload);
  },

  update(id: number, payload: Partial<ParticipantInput>): Promise<Participant> {
    return api.patch<Participant>(`/participants/${id}`, payload);
  },

  byCode(code: string): Promise<Participant> {
    return api.get<Participant>(`/participants/by-code/${encodeURIComponent(code)}`);
  },

  // --- Catálogos (TASK-2.1) ---
  schools(search?: string, limit = 200): Promise<Paginated<School>> {
    return api.get<Paginated<School>>(`/schools${toQuery({ search, limit })}`);
  },

  createSchool(payload: { name: string; city?: string }): Promise<School> {
    return api.post<School>('/schools', payload);
  },

  updateSchool(id: number, payload: { name?: string; city?: string }): Promise<School> {
    return api.patch<School>(`/schools/${id}`, payload);
  },

  deleteSchool(id: number): Promise<{ id: number; deleted: true }> {
    return api.delete<{ id: number; deleted: true }>(`/schools/${id}`);
  },

  committees(search?: string, limit = 200): Promise<Paginated<Committee>> {
    return api.get<Paginated<Committee>>(`/committees${toQuery({ search, limit })}`);
  },

  createCommittee(payload: { name: string; shortName?: string }): Promise<Committee> {
    return api.post<Committee>('/committees', payload);
  },

  updateCommittee(id: number, payload: { name?: string; shortName?: string }): Promise<Committee> {
    return api.patch<Committee>(`/committees/${id}`, payload);
  },

  deleteCommittee(id: number): Promise<{ id: number; deleted: true }> {
    return api.delete<{ id: number; deleted: true }>(`/committees/${id}`);
  },

  // --- Importación masiva (TASK-2.4) ---
  importTemplate(): Promise<Blob> {
    return api.getBlob('/participants/import/template');
  },

  importFile(
    file: File,
    options: {
      confirm: boolean;
      createMissingCatalogs: boolean;
      defaultRole?: string;
      defaultSchoolName?: string;
    },
  ): Promise<ImportReport> {
    const form = new FormData();
    form.append('file', file);
    form.append('confirm', String(options.confirm));
    form.append('createMissingCatalogs', String(options.createMissingCatalogs));
    if (options.defaultRole) form.append('defaultRole', options.defaultRole);
    if (options.defaultSchoolName) form.append('defaultSchoolName', options.defaultSchoolName);
    return api.postForm<ImportReport>('/participants/import', form);
  },

  // --- Credenciales (TASK-2.5 / TASK-2.6) ---
  badgePdf(
    id: number,
    options: { format?: 'card' | 'a4'; reprint?: boolean; reason?: string } = {},
  ): Promise<Blob> {
    return api.getBlob(
      `/badges/${id}.pdf${toQuery({
        format: options.format ?? 'card',
        reprint: options.reprint ? 'true' : undefined,
        reason: options.reason,
        disposition: 'inline',
      })}`,
    );
  },

  badgeBatch(payload: BadgeBatchPayload): Promise<Blob> {
    return api.postBlob('/badges/pdf', payload);
  },

  badgeReprint(payload: BadgeBatchPayload): Promise<Blob> {
    return api.postBlob('/badges/reprint', payload);
  },
};
