import { api } from '../../lib/api';
import type { ScanOutcome, ScanSearchResult, ScanSource } from './types';

export interface ScanPayload {
  code?: string;
  participantId?: number;
  checkpointId: number;
  source?: ScanSource;
}

export const scanApi = {
  register(payload: ScanPayload) {
    return api.post<ScanOutcome>('/scans', payload);
  },

  override(payload: ScanPayload & { reason: string }) {
    return api.post<ScanOutcome>('/scans/override', payload);
  },

  voidScan(scanId: string, reason: string) {
    return api.post<ScanOutcome & { voidedReason: string }>(`/scans/${scanId}/void`, { reason });
  },

  search(q: string, checkpointId: number) {
    return api.get<{ checkpoint: { id: number; name: string }; data: ScanSearchResult[] }>(
      `/scans/search?q=${encodeURIComponent(q)}&checkpointId=${checkpointId}`,
    );
  },
};

/** Normaliza lo leído del QR o digitado: mayúsculas, sin guiones ni espacios. */
export function normalizeCode(value: string): string {
  return value.toUpperCase().replace(/[\s\-_.]/g, '');
}

/** Presentación cosmética `K7P-3Q9`. */
export function formatCode(code: string | null | undefined): string {
  if (!code) return '';
  const clean = normalizeCode(code);
  return clean.length === 6 ? `${clean.slice(0, 3)}-${clean.slice(3)}` : clean;
}
