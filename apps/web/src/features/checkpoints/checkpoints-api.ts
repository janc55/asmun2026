import { api } from '../../lib/api';
import type { Checkpoint, CheckpointInput } from './types';

function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const checkpointsApi = {
  list(params: {
    search?: string;
    day?: string;
    type?: string;
    isActive?: boolean | '';
    onlyOpen?: boolean;
    page?: number;
    limit?: number;
  } = {}) {
    return api.get<{ data: Checkpoint[]; meta: { total: number; page: number; limit: number; totalPages: number } }>(
      `/checkpoints${toQuery({ ...params, limit: params.limit ?? 200 })}`,
    );
  },

  /** Puntos que el usuario autenticado puede operar, con su estado. */
  available() {
    return api.get<Checkpoint[]>('/checkpoints/available');
  },

  detail(id: number) {
    return api.get<Checkpoint>(`/checkpoints/${id}`);
  },

  create(input: CheckpointInput) {
    return api.post<Checkpoint>('/checkpoints', input);
  },

  update(id: number, input: Partial<CheckpointInput>) {
    return api.patch<Checkpoint>(`/checkpoints/${id}`, input);
  },

  remove(id: number) {
    return api.delete<{ id: number; deleted: true }>(`/checkpoints/${id}`);
  },
};
