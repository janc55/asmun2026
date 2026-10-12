'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, RefreshCw, Trash2, UserCog } from 'lucide-react';
import { apiErrorMessage } from '../../lib/api';
import { Alert, Badge, Button, Card, EmptyState, IconButton, Input, Select, Spinner } from '../../components/ui/primitives';
import { UserFormModal } from './UserFormModal';
import { usersApi } from './users-api';
import { AppUser, USER_ROLE_OPTIONS, UserRole, userRoleLabel } from './types';
import type { Checkpoint } from '../checkpoints/types';

const ROLE_BADGES: Record<string, string> = {
  admin: 'bg-purple-50 text-purple-700 border-purple-200',
  registrador: 'bg-blue-50 text-blue-700 border-blue-200',
  operador: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  lector: 'bg-amber-50 text-amber-700 border-amber-200',
};

export interface OperatorAssignmentsProps {
  checkpoints: Checkpoint[];
  /** `true` cuando el usuario puede crear y editar (solo admin). */
  canManage: boolean;
}

export function OperatorAssignments({ checkpoints, canManage }: OperatorAssignmentsProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('operador');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await usersApi.list({ role: roleFilter, search: search.trim() || undefined });
      setUsers(response.data);
    } catch (loadError) {
      setError(apiErrorMessage(loadError, 'No se pudo cargar la lista de usuarios'));
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const remove = async (user: AppUser) => {
    if (!window.confirm(`¿Eliminar el usuario '${user.username}'?`)) return;
    setError(null);
    try {
      await usersApi.remove(user.id);
      setNotice(`Usuario '${user.username}' eliminado.`);
      load();
    } catch (removeError) {
      setError(apiErrorMessage(removeError, 'No se pudo eliminar el usuario'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por usuario o nombre"
            className="sm:max-w-xs"
            aria-label="Buscar usuarios"
          />
          <Select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as UserRole | '')}
            className="sm:max-w-[220px]"
            aria-label="Filtrar por rol"
          >
            <option value="">Todos los roles</option>
            {USER_ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={load} loading={loading}>
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </Button>
          {canManage && (
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              Nuevo usuario
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card className="overflow-hidden">
        {loading && users.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-gray-500">
            <Spinner className="w-5 h-5" /> Cargando usuarios…
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            title="Sin usuarios en este filtro"
            description="Cree los usuarios de puerta y asígneles los puntos de control que van a operar."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Usuario</th>
                  <th className="px-4 py-3 text-left font-medium">Rol</th>
                  <th className="px-4 py-3 text-left font-medium">Puntos asignados</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/70 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{user.fullName}</div>
                      <div className="text-xs text-gray-500">{user.username}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={ROLE_BADGES[user.role] ?? 'bg-gray-100 text-gray-700 border-gray-200'}>
                        {userRoleLabel(user.role)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {user.role !== 'operador' ? (
                        <span className="text-xs text-gray-500">Todos los puntos</span>
                      ) : user.assignedCheckpoints.length === 0 ? (
                        <span className="text-xs text-amber-600">Sin asignaciones: no podrá registrar</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {user.assignedCheckpoints.map((checkpoint) => (
                            <Badge key={checkpoint.id} className="bg-gray-100 text-gray-700 border-gray-200">
                              {checkpoint.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.isActive ? (
                        <Badge className="bg-green-50 text-green-700 border-green-200">Activo</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-600 border-gray-300">Inactivo</Badge>
                      )}
                      {user.scansCount > 0 && (
                        <div className="mt-1 text-xs text-gray-500">{user.scansCount} escaneo(s)</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canManage ? (
                          <>
                            <IconButton
                              label="Editar y asignar puntos"
                              onClick={() => {
                                setEditing(user);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </IconButton>
                            <IconButton label="Eliminar usuario" onClick={() => remove(user)}>
                              <Trash2 className="w-4 h-4" />
                            </IconButton>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">Solo lectura</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="flex items-center gap-2 text-xs text-gray-500">
        <UserCog className="w-4 h-4" />
        Un operador sin puntos asignados no podrá registrar escaneos; los administradores y registradores
        operan cualquier punto vigente.
      </p>

      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        user={editing}
        checkpoints={checkpoints}
        onSaved={() => {
          setNotice(editing ? 'Usuario actualizado.' : 'Usuario creado.');
          load();
        }}
      />
    </div>
  );
}
