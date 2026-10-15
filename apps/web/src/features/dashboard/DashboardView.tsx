'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Search,
  Users,
  XCircle,
} from 'lucide-react';
import { apiErrorMessage, saveBlob } from '../../lib/api';
import { formatDayLabel, todayInEventZone } from '../../lib/datetime';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  Spinner,
} from '../../components/ui/primitives';
import { participantsApi } from '../participants/participants-api';
import { reportsApi } from '../reports/reports-api';
import type { School } from '../participants/types';
import { dashboardApi } from './dashboard-api';
import { KpiCard, ProgressBar, TypeCard } from './widgets';
import { DashboardSummary, KPI_TYPE_ORDER, PendingResponse } from './types';

const POLL_INTERVAL_MS = 5000;

const STATUS_CHIP: Record<string, string> = {
  abierto: 'bg-green-50 text-green-700 border-green-200',
  programado: 'bg-primary-50 text-primary-700 border-primary-200',
  finalizado: 'bg-gray-100 text-gray-600 border-gray-300',
  desactivado: 'bg-amber-50 text-amber-700 border-amber-200',
};

export interface DashboardViewProps {
  /** El rol `lector` solo consulta: sin botones de exportación. */
  canExport: boolean;
}

export function DashboardView({ canExport }: DashboardViewProps) {
  const [day, setDay] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [schools, setSchools] = useState<School[]>([]);

  const [pendingCheckpointId, setPendingCheckpointId] = useState<number | null>(null);
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingSchool, setPendingSchool] = useState('');
  const [pendingPage, setPendingPage] = useState(1);
  const [pending, setPending] = useState<PendingResponse | null>(null);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const today = todayInEventZone();

  const loadSummary = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true);

      try {
        const response = await dashboardApi.summary({ day: day || undefined });
        setSummary(response);
        setLastUpdate(new Date());
        setError(null);
      } catch (loadError) {
        setError(apiErrorMessage(loadError, 'No se pudo cargar el panel'));
      } finally {
        if (!options?.silent) setLoading(false);
      }
    },
    [day],
  );

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Polling cada 5 s (SDD 6) que se detiene cuando la pestaña no está visible.
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void loadSummary({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [autoRefresh, loadSummary]);

  useEffect(() => {
    participantsApi
      .schools()
      .then((response) => setSchools(response.data))
      .catch(() => setSchools([]));
  }, []);

  // Punto por defecto de la lista de pendientes: el primero abierto.
  useEffect(() => {
    if (!summary) return;
    if (pendingCheckpointId && summary.checkpoints.some((item) => item.id === pendingCheckpointId)) return;

    const preferred = summary.checkpoints.find((item) => item.status.isOpen) ?? summary.checkpoints[0] ?? null;
    setPendingCheckpointId(preferred ? preferred.id : null);
    setPendingPage(1);
  }, [summary, pendingCheckpointId]);

  useEffect(() => {
    if (!pendingCheckpointId) {
      setPending(null);
      return;
    }

    const timer = window.setTimeout(
      async () => {
        setPendingLoading(true);
        try {
          const response = await dashboardApi.pending({
            checkpointId: pendingCheckpointId,
            search: pendingSearch.trim() || undefined,
            schoolId: pendingSchool ? Number(pendingSchool) : undefined,
            page: pendingPage,
          });
          setPending(response);
        } catch (loadError) {
          setError(apiErrorMessage(loadError, 'No se pudieron cargar los pendientes'));
        } finally {
          setPendingLoading(false);
        }
      },
      pendingSearch ? 350 : 0,
    );

    return () => window.clearTimeout(timer);
  }, [pendingCheckpointId, pendingSearch, pendingSchool, pendingPage]);

  const byType = useMemo(() => {
    if (!summary) return [];
    return [...summary.byType].sort(
      (a, b) => KPI_TYPE_ORDER.indexOf(a.type) - KPI_TYPE_ORDER.indexOf(b.type),
    );
  }, [summary]);

  const exportPending = async () => {
    if (!pendingCheckpointId) return;

    setExporting(true);
    setError(null);
    try {
      const download = await reportsApi.pending({ checkpointId: pendingCheckpointId });
      saveBlob(download.blob, download.filename ?? 'pendientes.xlsx');
      setNotice(
        download.rowCount !== null
          ? `Se exportaron ${download.rowCount} pendiente(s) a Excel.`
          : 'Lista de pendientes exportada.',
      );
    } catch (exportError) {
      setError(apiErrorMessage(exportError, 'No se pudo exportar la lista de pendientes'));
    } finally {
      setExporting(false);
    }
  };

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-gray-500">
        <Spinner className="w-5 h-5" /> Cargando el panel…
      </div>
    );
  }

  const totals = summary?.totals;
  const rejectionTone = totals && totals.rejectedScans > 0 ? 'warning' : 'neutral';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Encabezado y controles */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Panel en tiempo real</h1>
          <p className="text-sm text-gray-600">
            {summary
              ? `${summary.event.name} · ${totals?.activeParticipants ?? 0} participantes activos · ${totals?.checkpoints ?? 0} punto(s) de control`
              : 'Sin datos todavía'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={day}
            onChange={(event) => {
              setDay(event.target.value);
              setPendingPage(1);
            }}
            aria-label="Filtrar por día del evento"
            className="sm:max-w-[220px]"
          >
            <option value="">Todos los días</option>
            {(summary?.event.days ?? []).map((item) => (
              <option key={item} value={item}>
                {item === today ? `${formatDayLabel(item)} (hoy)` : formatDayLabel(item)}
              </option>
            ))}
          </Select>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none px-1">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            En vivo (5 s)
          </label>

          <Button type="button" variant="secondary" onClick={() => loadSummary()} loading={loading}>
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error">
          <div className="flex items-start justify-between gap-3">
            <span>{error}</span>
            <button type="button" className="text-xs underline" onClick={() => setError(null)}>
              ocultar
            </button>
          </div>
        </Alert>
      )}
      {notice && (
        <Alert variant="success">
          <div className="flex items-start justify-between gap-3">
            <span>{notice}</span>
            <button type="button" className="text-xs underline" onClick={() => setNotice(null)}>
              ocultar
            </button>
          </div>
        </Alert>
      )}

      {lastUpdate && (
        <p className="text-xs text-gray-500">
          {autoRefresh ? 'Actualización automática cada 5 s' : 'Actualización manual'} · última lectura{' '}
          {lastUpdate.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
      )}

      {/* Cifras clave */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Participantes activos"
          value={totals?.activeParticipants ?? 0}
          hint={`${totals?.openCheckpoints ?? 0} punto(s) abierto(s) ahora`}
          icon={Users}
          tone="neutral"
        />
        <KpiCard
          label="Con ingreso registrado"
          value={`${totals?.attendedParticipants ?? 0} / ${totals?.activeParticipants ?? 0}`}
          hint={`${totals?.attendancePercentage ?? 0}% del total`}
          icon={CheckCircle2}
          tone={(totals?.attendancePercentage ?? 0) >= 90 ? 'ok' : 'primary'}
          progress={totals?.attendancePercentage ?? 0}
        />
        <KpiCard
          label="Registros válidos"
          value={totals?.validScans ?? 0}
          hint={`${totals?.exceptions ?? 0} por excepción autorizada`}
          icon={Activity}
          tone="ok"
        />
        <KpiCard
          label="Intentos rechazados"
          value={totals?.rejectedScans ?? 0}
          hint={`${totals?.voidedScans ?? 0} escaneo(s) anulado(s)`}
          icon={XCircle}
          tone={rejectionTone}
        />
      </div>

      {/* Avance por tipo de control */}
      {byType.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Avance por tipo de control
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {byType.map((item) => (
              <TypeCard key={item.type} item={item} />
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Avance por punto de control */}
        <Card className="xl:col-span-2 overflow-hidden">
          <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Puntos de control ({summary?.checkpoints.length ?? 0})
            </h2>
            <span className="text-xs text-gray-500">Toque un punto para ver sus pendientes</span>
          </header>

          {summary && summary.checkpoints.length === 0 ? (
            <EmptyState
              title="Sin puntos de control"
              description="Cree los puntos del evento para empezar a medir el avance."
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {summary?.checkpoints.map((checkpoint) => {
                const tone =
                  checkpoint.percentage >= 90 ? 'ok' : checkpoint.percentage >= 50 ? 'warning' : 'error';

                return (
                  <li key={checkpoint.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingCheckpointId(checkpoint.id);
                        setPendingPage(1);
                      }}
                      className={`w-full text-left px-4 py-3 transition-colors hover:bg-gray-50 ${
                        pendingCheckpointId === checkpoint.id ? 'bg-primary-50/60' : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900">{checkpoint.name}</span>
                            <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                              {checkpoint.typeLabel}
                            </Badge>
                            <Badge className={STATUS_CHIP[checkpoint.status.label]}>
                              {checkpoint.status.label}
                            </Badge>
                          </div>
                          <div className="mt-0.5 text-xs text-gray-500">
                            {checkpoint.dayLabel} · {checkpoint.windowLabel}
                            {checkpoint.lastScanAtLabel ? ` · último registro ${checkpoint.lastScanAtLabel}` : ''}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900">
                            {checkpoint.registered}
                            <span className="text-sm font-medium text-gray-500"> / {checkpoint.expected}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {checkpoint.percentage}% · faltan {checkpoint.pending}
                          </div>
                        </div>
                      </div>

                      <ProgressBar
                        value={checkpoint.percentage}
                        tone={tone}
                        className="mt-2"
                      />

                      {(checkpoint.exceptions > 0 ||
                        checkpoint.duplicates > 0 ||
                        checkpoint.voided > 0 ||
                        checkpoint.rejected > 0) && (
                        <div className="mt-2 flex flex-wrap gap-3 text-xs">
                          {checkpoint.exceptions > 0 && (
                            <span className="text-primary-700">{checkpoint.exceptions} excepción(es)</span>
                          )}
                          {checkpoint.duplicates > 0 && (
                            <span className="flex items-center gap-1 text-status-error">
                              <AlertTriangle className="w-3 h-3" />
                              {checkpoint.duplicates} duplicado(s)
                            </span>
                          )}
                          {checkpoint.rejected > 0 && (
                            <span className="text-gray-500">{checkpoint.rejected} rechazado(s)</span>
                          )}
                          {checkpoint.voided > 0 && (
                            <span className="text-gray-500">{checkpoint.voided} anulado(s)</span>
                          )}
                        </div>
                      )}

                      {checkpoint.bySchool.length > 1 && (
                        <div className="mt-2 space-y-1">
                          {checkpoint.bySchool.slice(0, 4).map((school) => (
                            <div key={`${checkpoint.id}-${school.schoolId ?? 'none'}`} className="flex items-center gap-2">
                              <span className="w-40 truncate text-xs text-gray-600">{school.school}</span>
                              <ProgressBar
                                value={school.expected > 0 ? (school.registered / school.expected) * 100 : 0}
                                className="flex-1"
                              />
                              <span className="w-16 text-right text-xs text-gray-500">
                                {school.registered}/{school.expected}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Desglose por colegio */}
        <Card className="overflow-hidden">
          <header className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Desglose por colegio</h2>
            <p className="text-xs text-gray-500">Participantes con al menos un registro válido</p>
          </header>

          {summary && summary.bySchool.length === 0 ? (
            <EmptyState title="Sin colegios registrados" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {summary?.bySchool.map((school) => (
                <li key={school.schoolId ?? 'none'} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{school.school}</span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {school.registered}/{school.expected}
                    </span>
                  </div>
                  <ProgressBar
                    value={school.percentage}
                    tone={school.percentage >= 90 ? 'ok' : school.percentage >= 50 ? 'warning' : 'error'}
                    className="mt-2"
                  />
                  <div className="mt-1 text-xs text-gray-500">
                    {school.percentage}% · faltan {school.pending}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Pendientes */}
      <Card className="overflow-hidden">
        <header className="px-4 py-3 border-b border-gray-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Pendientes{pending ? ` de «${pending.checkpoint.name}»` : ''}
              </h2>
              <p className="text-xs text-gray-500">
                {pending
                  ? `${pending.meta.total} participante(s) aún no cumplen este punto`
                  : 'Elija un punto de control'}
              </p>
            </div>

            {canExport && (
              <Button
                type="button"
                variant="secondary"
                onClick={exportPending}
                loading={exporting}
                disabled={!pendingCheckpointId || (pending?.meta.total ?? 0) === 0}
              >
                <Download className="w-4 h-4" />
                Exportar Excel
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              value={pendingCheckpointId ? String(pendingCheckpointId) : ''}
              onChange={(event) => {
                setPendingCheckpointId(event.target.value ? Number(event.target.value) : null);
                setPendingPage(1);
              }}
              aria-label="Punto de control de los pendientes"
            >
              <option value="">Elija un punto de control</option>
              {summary?.checkpoints.map((checkpoint) => (
                <option key={checkpoint.id} value={checkpoint.id}>
                  {checkpoint.name} · {checkpoint.dayLabel} ({checkpoint.pending} pendientes)
                </option>
              ))}
            </Select>

            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={pendingSearch}
                onChange={(event) => {
                  setPendingSearch(event.target.value);
                  setPendingPage(1);
                }}
                placeholder="Buscar por nombre o código"
                className="pl-9"
                aria-label="Buscar pendientes"
              />
            </div>

            <Select
              value={pendingSchool}
              onChange={(event) => {
                setPendingSchool(event.target.value);
                setPendingPage(1);
              }}
              aria-label="Filtrar pendientes por colegio"
            >
              <option value="">Todos los colegios</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </Select>
          </div>
        </header>

        {pendingLoading && !pending ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
            <Spinner className="w-4 h-4" /> Cargando pendientes…
          </div>
        ) : !pending || pending.data.length === 0 ? (
          <EmptyState
            title={pendingCheckpointId ? 'Sin pendientes en este filtro' : 'Elija un punto de control'}
            description={
              pendingCheckpointId
                ? 'Todos los participantes esperados ya cumplieron este punto (o el filtro no devuelve resultados).'
                : 'Seleccione arriba el punto del que quiere ver quiénes faltan.'
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Participante</th>
                    <th className="px-4 py-2 text-left font-medium">Rol</th>
                    <th className="px-4 py-2 text-left font-medium">Colegio</th>
                    <th className="px-4 py-2 text-left font-medium">Comité</th>
                    <th className="px-4 py-2 text-left font-medium">Alimentación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pending.data.map((participant) => (
                    <tr key={participant.id} className="hover:bg-gray-50/70">
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">{participant.name}</div>
                        <div className="font-mono text-xs text-gray-500">{participant.code}</div>
                      </td>
                      <td className="px-4 py-2 text-gray-700">{participant.roleLabel}</td>
                      <td className="px-4 py-2 text-gray-700">{participant.school ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {participant.committee ?? '—'}
                        {participant.committeeShort ? ` (${participant.committeeShort})` : ''}
                      </td>
                      <td className="px-4 py-2">
                        {participant.dietaryNotes ? (
                          <span
                            title={participant.dietaryNotes}
                            className="inline-flex items-center gap-1 text-status-error"
                          >
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-xs">{participant.dietaryNotes}</span>
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50">
              <span className="text-xs text-gray-600">
                Página {pending.meta.page} de {Math.max(pending.meta.totalPages, 1)} · {pending.meta.total} registro(s)
                {pendingLoading ? ' · actualizando…' : ''}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending.meta.page <= 1}
                  onClick={() => setPendingPage((current) => Math.max(current - 1, 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending.meta.page >= pending.meta.totalPages}
                  onClick={() => setPendingPage((current) => current + 1)}
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
