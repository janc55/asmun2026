import { api } from '../../lib/api';
import type { AuditResponse, ScanHistoryResponse } from './types';

function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const auditApi = {
  list(params: {
    action?: string;
    userId?: number | '';
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    return api.get<AuditResponse>(`/audit${toQuery({ ...params, limit: params.limit ?? 25 })}`);
  },

  scans(params: {
    day?: string;
    from?: string;
    to?: string;
    checkpointId?: number | '';
    result?: string;
    source?: string;
    userId?: number | '';
    search?: string;
    page?: number;
    limit?: number;
  }) {
    return api.get<ScanHistoryResponse>(`/scans${toQuery({ ...params, limit: params.limit ?? 25 })}`);
  },

  voidScan(id: string, reason: string) {
    return api.post<{ id: string; result: string; message: string }>(`/scans/${id}/void`, { reason });
  },
};
