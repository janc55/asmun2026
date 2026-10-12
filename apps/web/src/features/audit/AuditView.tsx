'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  History,
  RefreshCw,
  Search,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import { apiErrorMessage } from '../../lib/api';
import { todayInEventZone } from '../../lib/datetime';
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
import { checkpointsApi } from '../checkpoints/checkpoints-api';
import type { Checkpoint } from '../checkpoints/types';
import { auditApi } from './audit-api';
import {
  AuditResponse,
  SCAN_RESULT_OPTIONS,
  ScanHistoryResponse,
  resultChipClasses,
} from './types';

type Tab = 'eventos' | 'escaneos';

const ACTION_CHIP: Record<string, string> = {
  excepcion: 'bg-primary-50 text-primary-700 border-primary-100',
  anular_scan: 'bg-red-50 text-red-700 border-red-200',
  reimpresion: 'bg-amber-50 text-amber-700 border-amber-200',
};

export function AuditView() {
  const [tab, setTab] = useState<Tab>('eventos');
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);

  const [events, setEvents] = useState<AuditResponse | null>(null);
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [eventPage, setEventPage] = useState(1);

  const [scans, setScans] = useState<ScanHistoryResponse | null>(null);
  const [scanDay, setScanDay] = useState('');
  const [scanCheckpoint, setScanCheckpoint] = useState('');
  const [scanResult, setScanResult] = useState('');
  const [scanSearch, setScanSearch] = useState('');
  const [scanPage, setScanPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await auditApi.list({
        action: actionFilter || undefined,
        userId: userFilter ? Number(userFilter) : '',
        search: eventSearch.trim() || undefined,
        page: eventPage,
      });
      setEvents(response);
      setError(null);
    } catch (loadError) {
      setError(apiErrorMessage(loadError, 'No se pudo cargar la auditoría'));
    } finally {
      setLoading(false);
    }
  }, [actionFilter, userFilter, eventSearch, eventPage]);

  const loadScans = useCallback(async () => {
    setLoading(true);
    try {
      const response = await auditApi.scans({
        day: scanDay || undefined,
        checkpointId: scanCheckpoint ? Number(scanCheckpoint) : '',
        result: scanResult || undefined,
        search: scanSearch.trim() || undefined,
        page: scanPage,
      });
      setScans(response);
      setError(null);
    } catch (loadError) {
      setError(apiErrorMessage(loadError, 'No se pudo cargar el historial de escaneos'));
    } finally {
      setLoading(false);
    }
  }, [scanDay, scanCheckpoint, scanResult, scanSearch, scanPage]);

  useEffect(() => {
    checkpointsApi
      .list()
      .then((response) => setCheckpoints(response.data))
      .catch(() => setCheckpoints([]));
  }, []);

  useEffect(() => {
    if (tab !== 'eventos') return;
    const timer = window.setTimeout(loadEvents, eventSearch ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [tab, loadEvents, eventSearch]);

  useEffect(() => {
    if (tab !== 'escaneos') return;
    const timer = window.setTimeout(loadScans, scanSearch ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [tab, loadScans, scanSearch]);

  const voidScan = async (id: string, participantName: string) => {
    const reason = window.prompt(
      `Motivo para anular el escaneo de ${participantName}:`,
      'Escaneo registrado por error',
    );
    if (reason === null) return;
    if (reason.trim().length < 3) {
      setError('El motivo de la anulación debe ser más descriptivo.');
      return;
    }

    setVoidingId(id);
    setError(null);
    setNotice(null);

    try {
      const response = await auditApi.voidScan(id, reason.trim());
      setNotice(response.message ?? 'Escaneo anulado. La persona puede registrarse de nuevo.');
      await loadScans();
      await loadEvents();
    } catch (voidError) {
      setError(apiErrorMessage(voidError, 'No se pudo anular el escaneo'));
    } finally {
      setVoidingId(null);
    }
  };

  const days = Array.from(new Set(checkpoints.map((checkpoint) => checkpoint.day))).sort();
  const today = todayInEventZone();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Auditoría</h1>
          <p className="text-sm text-gray-600">
            Excepciones, anulaciones y reimpresiones con su responsable, más el historial completo de escaneos.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          loading={loading}
          onClick={() => (tab === 'eventos' ? loadEvents() : loadScans())}
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </Button>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {(
          [
            { id: 'eventos', label: 'Eventos auditados', icon: ShieldCheck },
            { id: 'escaneos', label: 'Historial de escaneos', icon: History },
          ] as Array<{ id: Tab; label: string; icon: typeof ShieldCheck }>
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-2 px-4 py-2.5 -mb-px text-sm font-medium border-b-2 transition-colors ${
                tab === item.id
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
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

      {tab === 'eventos' ? (
        <>
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Select
                value={actionFilter}
                onChange={(event) => {
                  setActionFilter(event.target.value);
                  setEventPage(1);
                }}
                aria-label="Filtrar por acción"
              >
                <option value="">Todas las acciones</option>
                {(events?.meta.filters.actions ?? []).map((item) => (
                  <option key={item.action} value={item.action}>
                    {item.label} ({item.count})
                  </option>
                ))}
              </Select>

              <Select
                value={userFilter}
                onChange={(event) => {
                  setUserFilter(event.target.value);
                  setEventPage(1);
                }}
                aria-label="Filtrar por usuario"
              >
                <option value="">Todos los usuarios</option>
                {(events?.meta.filters.users ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fullName}
                  </option>
                ))}
              </Select>

              <div className="relative lg:col-span-2">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={eventSearch}
                  onChange={(event) => {
                    setEventSearch(event.target.value);
                    setEventPage(1);
                  }}
                  placeholder="Buscar en el motivo"
                  className="pl-9"
                  aria-label="Buscar en la auditoría"
                />
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            {loading && !events ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
                <Spinner className="w-5 h-5" /> Cargando auditoría…
              </div>
            ) : !events || events.data.length === 0 ? (
              <EmptyState
                title="Sin eventos auditados"
                description="Aquí aparecerán las excepciones autorizadas, los escaneos anulados y las reimpresiones de credenciales."
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Fecha y hora</th>
                        <th className="px-4 py-3 text-left font-medium">Acción</th>
                        <th className="px-4 py-3 text-left font-medium">Entidad</th>
                        <th className="px-4 py-3 text-left font-medium">Responsable</th>
                        <th className="px-4 py-3 text-left font-medium">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {events.data.map((event) => (
                        <tr key={event.id} className="hover:bg-gray-50/70 align-top">
                          <td className="px-4 py-3 whitespace-nowrap text-gray-700">{event.createdAtLabel}</td>
                          <td className="px-4 py-3">
                            <Badge className={ACTION_CHIP[event.action] ?? 'bg-gray-100 text-gray-700 border-gray-200'}>
                              {event.actionLabel}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {event.entity}
                            {event.entityId ? ` · ${event.entityId.slice(0, 8)}…` : ''}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {event.user?.fullName ?? 'Sistema'}
                            {event.user && <div className="text-xs text-gray-500">{event.user.role}</div>}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{event.reason ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <span className="text-xs text-gray-600">
                    Página {events.meta.page} de {Math.max(events.meta.totalPages, 1)} · {events.meta.total} evento(s)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={events.meta.page <= 1}
                      onClick={() => setEventPage((current) => Math.max(current - 1, 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={events.meta.page >= events.meta.totalPages}
                      onClick={() => setEventPage((current) => current + 1)}
                    >
                      Siguiente
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </>
      ) : (
        <>
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Select
                value={scanDay}
                onChange={(event) => {
                  setScanDay(event.target.value);
                  setScanPage(1);
                }}
                aria-label="Filtrar por día"
              >
                <option value="">Todos los días</option>
                {days.map((day) => (
                  <option key={day} value={day}>
                    {day === today ? `${day} (hoy)` : day}
                  </option>
                ))}
              </Select>

              <Select
                value={scanCheckpoint}
                onChange={(event) => {
                  setScanCheckpoint(event.target.value);
                  setScanPage(1);
                }}
                aria-label="Filtrar por punto de control"
              >
                <option value="">Todos los puntos</option>
                {checkpoints.map((checkpoint) => (
                  <option key={checkpoint.id} value={checkpoint.id}>
                    {checkpoint.name} · {checkpoint.dayLabel}
                  </option>
                ))}
              </Select>

              <Select
                value={scanResult}
                onChange={(event) => {
                  setScanResult(event.target.value);
                  setScanPage(1);
                }}
                aria-label="Filtrar por resultado"
              >
                <option value="">Todos los resultados</option>
                {SCAN_RESULT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={scanSearch}
                  onChange={(event) => {
                    setScanSearch(event.target.value);
                    setScanPage(1);
                  }}
                  placeholder="Buscar participante"
                  className="pl-9"
                  aria-label="Buscar participante en el historial"
                />
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            {loading && !scans ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
                <Spinner className="w-5 h-5" /> Cargando historial…
              </div>
            ) : !scans || scans.data.length === 0 ? (
              <EmptyState title="Sin registros con estos filtros" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Fecha y hora</th>
                        <th className="px-4 py-3 text-left font-medium">Participante</th>
                        <th className="px-4 py-3 text-left font-medium">Punto</th>
                        <th className="px-4 py-3 text-left font-medium">Resultado</th>
                        <th className="px-4 py-3 text-left font-medium">Operador</th>
                        <th className="px-4 py-3 text-right font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {scans.data.map((scan) => {
                        const canVoid = scan.result === 'ok' || scan.result === 'excepcion';

                        return (
                          <tr key={scan.id} className="hover:bg-gray-50/70 align-top">
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                              {scan.dateLabel}
                              <div className="text-xs text-gray-500">{scan.timeLabel}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">
                                {scan.participant?.name ?? 'Sin identificar'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {scan.participant
                                  ? `${scan.participant.code} · ${scan.participant.roleLabel}${scan.participant.school ? ` · ${scan.participant.school}` : ''}`
                                  : scan.note ?? ''}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {scan.checkpoint.name}
                              <div className="text-xs text-gray-500">
                                {scan.checkpoint.typeLabel} · {scan.checkpoint.dayLabel}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge className={resultChipClasses(scan.color)}>{scan.resultLabel}</Badge>
                              <div className="mt-1 text-xs text-gray-500">{scan.sourceLabel}</div>
                              {scan.voided?.reason && (
                                <div className="mt-1 text-xs text-gray-500">
                                  Anulado por {scan.voided.by ?? '—'}: {scan.voided.reason}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-700">{scan.user.fullName}</td>
                            <td className="px-4 py-3 text-right">
                              {canVoid ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  loading={voidingId === scan.id}
                                  onClick={() => voidScan(scan.id, scan.participant?.name ?? 'sin identificar')}
                                  title="Anular este escaneo (queda en auditoría)"
                                >
                                  <Undo2 className="w-4 h-4" />
                                  Anular
                                </Button>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <span className="text-xs text-gray-600">
                    Página {scans.meta.page} de {Math.max(scans.meta.totalPages, 1)} · {scans.meta.total} registro(s)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={scans.meta.page <= 1}
                      onClick={() => setScanPage((current) => Math.max(current - 1, 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={scans.meta.page >= scans.meta.totalPages}
                      onClick={() => setScanPage((current) => current + 1)}
                    >
                      Siguiente
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
