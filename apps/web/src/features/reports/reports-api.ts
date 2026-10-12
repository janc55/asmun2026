import { api } from '../../lib/api';

function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export interface ReportDownload {
  blob: Blob;
  /** Nombre sugerido por el servidor (`Content-Disposition`). */
  filename: string | null;
  /** Filas exportadas, informadas por el servidor. */
  rowCount: number | null;
}

function parseFilename(disposition: string | null): string | null {
  if (!disposition) return null;
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return match ? match[1] : null;
}

async function download(endpoint: string): Promise<ReportDownload> {
  const { blob, headers } = await api.getFile(endpoint);
  const rowCount = Number(headers.get('x-row-count') ?? '');

  return {
    blob,
    filename: parseFilename(headers.get('content-disposition')),
    rowCount: Number.isFinite(rowCount) ? rowCount : null,
  };
}

export const reportsApi = {
  participants(params: {
    search?: string;
    schoolId?: number | '';
    committeeId?: number | '';
    role?: string;
    isActive?: boolean | '';
  }) {
    return download(
      `/reports/participants.xlsx${toQuery({
        search: params.search,
        schoolId: params.schoolId,
        committeeId: params.committeeId,
        role: params.role,
        isActive: params.isActive,
      })}`,
    );
  },

  scans(params: {
    day?: string;
    from?: string;
    to?: string;
    checkpointId?: number | '';
    result?: string;
    source?: string;
    schoolId?: number | '';
    search?: string;
  }) {
    return download(
      `/reports/scans.xlsx${toQuery({
        day: params.day,
        from: params.from,
        to: params.to,
        checkpointId: params.checkpointId,
        result: params.result,
        source: params.source,
        schoolId: params.schoolId,
        search: params.search,
      })}`,
    );
  },

  pending(params: { checkpointId: number | ''; schoolId?: number | ''; role?: string }) {
    return download(
      `/reports/pending.xlsx${toQuery({
        checkpointId: params.checkpointId,
        schoolId: params.schoolId,
        role: params.role,
      })}`,
    );
  },
};
