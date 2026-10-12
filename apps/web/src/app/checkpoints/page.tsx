'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Pencil, Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import { useAuth } from '../../context/auth-context';
import { apiErrorMessage } from '../../lib/api';
import { addDays, todayInEventZone } from '../../lib/datetime';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Select,
  Spinner,
} from '../../components/ui/primitives';
import { CheckpointFormModal } from '../../features/checkpoints/CheckpointFormModal';
import { checkpointsApi } from '../../features/checkpoints/checkpoints-api';
import {
  CHECKPOINT_TYPE_OPTIONS,
  Checkpoint,
  CheckpointStatusLabel,
  checkpointTypeLabel,
} from '../../features/checkpoints/types';
import { OperatorAssignments } from '../../features/users/OperatorAssignments';

const STATUS_STYLES: Record<CheckpointStatusLabel, string> = {
  abierto: 'bg-green-50 text-green-700 border-green-200',
  programado: 'bg-blue-50 text-blue-700 border-blue-200',
  finalizado: 'bg-gray-100 text-gray-600 border-gray-300',
  desactivado: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function CheckpointsPage() {
  const { user, isLoading: isAuthLoading, hasRole } = useAuth();
  const canRead = hasRole('admin', 'lector');
  const canManage = hasRole('admin');

  const [tab, setTab] = useState<'checkpoints' | 'operators'>('checkpoints');
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Checkpoint | null>(null);

  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const response = await checkpointsApi.list({
        day: dayFilter || undefined,
        type: typeFilter || undefined,
        onlyOpen: onlyOpen || undefined,
      });
      setCheckpoints(response.data);
    } catch (loadError) {
      setError(apiErrorMessage(loadError, 'No se pudieron cargar los puntos de control'));
    } finally {
      setLoading(false);
    }
  }, [canRead, dayFilter, typeFilter, onlyOpen]);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayInEventZone();
  const days = useMemo(() => {
    const set = new Set(checkpoints.map((checkpoint) => checkpoint.day));
    set.add(today);
    return Array.from(set).sort();
  }, [checkpoints, today]);

  const grouped = useMemo(() => {
    const map = new Map<string, Checkpoint[]>();
    checkpoints.forEach((checkpoint) => {
      const list = map.get(checkpoint.day) ?? [];
      list.push(checkpoint);
      map.set(checkpoint.day, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [checkpoints]);

  const remove = async (checkpoint: Checkpoint) => {
    if (!window.confirm(`¿Eliminar el punto '${checkpoint.name}'?`)) return;
    setError(null);
    try {
      await checkpointsApi.remove(checkpoint.id);
      setNotice(`Punto '${checkpoint.name}' eliminado.`);
      load();
    } catch (removeError) {
      setError(apiErrorMessage(removeError, 'No se pudo eliminar el punto de control'));
    }
  };

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (user && !canRead) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Alert variant="warning">
          Su rol ({user.role}) no tiene acceso a la configuración de puntos de control.
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Puntos de control</h1>
          <p className="text-sm text-gray-600">
            {checkpoints.length} punto(s) · ingreso, credenciales, material, refrigerios y almuerzos
          </p>
        </div>

        {tab === 'checkpoints' && canManage && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDayFilter(addDays(today, 1));
              }}
              title="Filtra el listado por el día siguiente para armar el programa"
            >
              <CalendarDays className="w-4 h-4" />
              Ver mañana
            </Button>
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              Nuevo punto
            </Button>
          </div>
        )}
      </div>

      {canManage && (
        <div className="flex gap-2 border-b border-gray-200">
          {(
            [
              { id: 'checkpoints', label: 'Puntos de control', icon: CalendarDays },
              { id: 'operators', label: 'Usuarios y operadores', icon: Users },
            ] as Array<{ id: 'checkpoints' | 'operators'; label: string; icon: typeof CalendarDays }>
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
      )}

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

      {tab === 'operators' && canManage ? (
        <OperatorAssignments checkpoints={checkpoints} canManage={canManage} />
      ) : (
        <>
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                value={dayFilter}
                onChange={(event) => setDayFilter(event.target.value)}
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
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                aria-label="Filtrar por tipo"
              >
                <option value="">Todos los tipos</option>
                {CHECKPOINT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none px-1">
                <input
                  type="checkbox"
                  checked={onlyOpen}
                  onChange={(event) => setOnlyOpen(event.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Solo abiertos ahora
              </label>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => load()} loading={loading}>
                <RefreshCw className="w-4 h-4" />
                Actualizar
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden">
            {loading && checkpoints.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
                <Spinner className="w-5 h-5" /> Cargando puntos de control…
              </div>
            ) : checkpoints.length === 0 ? (
              <EmptyState
                title="No hay puntos de control"
                description="Cree los puntos del evento: ingreso, entrega de credencial, material, refrigerios y almuerzos de cada día."
                action={
                  canManage ? (
                    <Button
                      type="button"
                      onClick={() => {
                        setEditing(null);
                        setFormOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      Nuevo punto
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Punto</th>
                      <th className="px-4 py-3 text-left font-medium">Ventana</th>
                      <th className="px-4 py-3 text-left font-medium">Depende de</th>
                      <th className="px-4 py-3 text-left font-medium">Roles</th>
                      <th className="px-4 py-3 text-center font-medium">Registros</th>
                      <th className="px-4 py-3 text-left font-medium">Estado</th>
                      {canManage && <th className="px-4 py-3 text-right font-medium">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {grouped.map(([day, items]) => (
                      <React.Fragment key={day}>
                        <tr className="bg-slate-50">
                          <td colSpan={canManage ? 7 : 6} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            {day === today ? `${day} · hoy` : day}
                          </td>
                        </tr>
                        {items.map((checkpoint) => (
                          <tr key={checkpoint.id} className="hover:bg-gray-50/70 align-top">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{checkpoint.name}</div>
                              <div className="text-xs text-gray-500">{checkpointTypeLabel(checkpoint.type)}</div>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{checkpoint.windowLabel}</td>
                            <td className="px-4 py-3 text-gray-700">
                              {checkpoint.requiresCheckpoint ? checkpoint.requiresCheckpoint.name : '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {checkpoint.appliesToRoles && checkpoint.appliesToRoles.length > 0
                                ? checkpoint.appliesToRoles.join(', ')
                                : 'Todos'}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700">{checkpoint.scansCount}</td>
                            <td className="px-4 py-3">
                              <Badge className={STATUS_STYLES[checkpoint.status.label]}>
                                {checkpoint.status.label}
                              </Badge>
                              <div className="mt-1 text-xs text-gray-500">{checkpoint.status.message}</div>
                            </td>
                            {canManage && (
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  <IconButton
                                    label="Editar punto"
                                    onClick={() => {
                                      setEditing(checkpoint);
                                      setFormOpen(true);
                                    }}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </IconButton>
                                  <IconButton
                                    label="Eliminar punto"
                                    onClick={() => remove(checkpoint)}
                                    disabled={checkpoint.scansCount > 0}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </IconButton>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      <CheckpointFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        checkpoint={editing}
        checkpoints={checkpoints}
        defaultDay={dayFilter || today}
        onSaved={() => {
          setNotice(editing ? 'Punto actualizado.' : 'Punto creado.');
          load();
        }}
      />
    </div>
  );
}
