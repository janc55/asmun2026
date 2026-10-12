import { api } from '../../lib/api';
import type { AppUser, UserInput, UserRole } from './types';

function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const usersApi = {
  list(params: { search?: string; role?: UserRole | ''; isActive?: boolean | ''; limit?: number } = {}) {
    return api.get<{ data: AppUser[]; meta: { total: number } }>(
      `/users${toQuery({ ...params, limit: params.limit ?? 200 })}`,
    );
  },

  create(input: UserInput & { username: string; fullName: string; password: string; role: UserRole }) {
    return api.post<AppUser>('/users', input);
  },

  update(id: number, input: UserInput) {
    return api.patch<AppUser>(`/users/${id}`, input);
  },

  /** Reemplaza los puntos asignados (solo aplica al rol operador). */
  assignCheckpoints(id: number, checkpointIds: number[]) {
    return api.put<AppUser>(`/users/${id}/checkpoints`, { checkpointIds });
  },

  remove(id: number) {
    return api.delete<{ id: number; deleted: true }>(`/users/${id}`);
  },
};
