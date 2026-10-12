import { api } from '../../lib/api';
import type { DashboardSummary, PendingResponse } from './types';

function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const dashboardApi = {
  summary(params: { day?: string; checkpointId?: number } = {}) {
    return api.get<DashboardSummary>(`/dashboard/summary${toQuery(params)}`);
  },

  pending(params: {
    checkpointId: number;
    search?: string;
    schoolId?: number;
    role?: string;
    page?: number;
    limit?: number;
  }) {
    return api.get<PendingResponse>(`/dashboard/pending${toQuery({ ...params, limit: params.limit ?? 25 })}`);
  },
};
