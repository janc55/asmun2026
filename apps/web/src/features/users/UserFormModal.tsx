'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { apiErrorMessage } from '../../lib/api';
import { Alert, Button, Field, Input, Select } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import type { Checkpoint } from '../checkpoints/types';
import { usersApi } from './users-api';
import { AppUser, USER_ROLE_OPTIONS, UserRole } from './types';

export interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  /** `null` crea un usuario nuevo. */
  user: AppUser | null;
  checkpoints: Checkpoint[];
  onSaved: () => void;
}

interface FormState {
  username: string;
  fullName: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  checkpointIds: number[];
}

const EMPTY: FormState = {
  username: '',
  fullName: '',
  password: '',
  role: 'operador',
  isActive: true,
  checkpointIds: [],
};

export function UserFormModal({ open, onClose, user, checkpoints, onSaved }: UserFormModalProps) {
  const isEdit = Boolean(user);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      user
        ? {
            username: user.username,
            fullName: user.fullName,
            password: '',
            role: user.role,
            isActive: user.isActive,
            checkpointIds: user.checkpointIds,
          }
        : EMPTY,
    );
  }, [open, user]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const canSubmit =
    form.fullName.trim().length >= 3 &&
    form.role !== undefined &&
    (isEdit || (form.username.trim().length >= 3 && form.password.length >= 8)) &&
    (isEdit ? form.password.length === 0 || form.password.length >= 8 : true) &&
    !saving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError(null);

    try {
      if (isEdit) {
        await usersApi.update(user!.id, {
          fullName: form.fullName.trim(),
          role: form.role,
          isActive: form.isActive,
          ...(form.password ? { password: form.password } : {}),
        });

        const changed =
          form.checkpointIds.length !== user!.checkpointIds.length ||
          form.checkpointIds.some((id) => !user!.checkpointIds.includes(id));
        if (changed) {
          await usersApi.assignCheckpoints(user!.id, form.checkpointIds);
        }
      } else {
        await usersApi.create({
          username: form.username.trim(),
          fullName: form.fullName.trim(),
          password: form.password,
          role: form.role,
          checkpointIds: form.checkpointIds,
        });
      }

      onSaved();
      onClose();
    } catch (submitError) {
      setError(apiErrorMessage(submitError, 'No se pudo guardar el usuario'));
    } finally {
      setSaving(false);
    }
  };

  const isOperator = form.role === 'operador';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Editar usuario · ${user?.username}` : 'Nuevo usuario'}
      description="El nombre de usuario no se puede cambiar después de crearlo."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="user-form" loading={saving} disabled={!canSubmit}>
            <Save className="w-4 h-4" />
            {isEdit ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-5">
        {error && <Alert variant="error">{error}</Alert>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Usuario" required={!isEdit} htmlFor="user-username">
            <Input
              id="user-username"
              value={form.username}
              onChange={(event) => update('username', event.target.value)}
              placeholder="operador1"
              disabled={isEdit}
              autoComplete="off"
            />
          </Field>

          <Field label="Nombre completo" required htmlFor="user-fullname">
            <Input
              id="user-fullname"
              value={form.fullName}
              onChange={(event) => update('fullName', event.target.value)}
              placeholder="Luis Mamani"
              autoComplete="off"
            />
          </Field>

          <Field
            label={isEdit ? 'Nueva contraseña' : 'Contraseña'}
            required={!isEdit}
            htmlFor="user-password"
            hint={isEdit ? 'Déjela vacía para conservar la actual' : 'Mínimo 8 caracteres'}
          >
            <Input
              id="user-password"
              type="password"
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
              placeholder={isEdit ? '••••••••' : 'Mínimo 8 caracteres'}
              autoComplete="new-password"
            />
          </Field>

          <Field label="Rol" required htmlFor="user-role">
            <Select id="user-role" value={form.role} onChange={(event) => update('role', event.target.value as UserRole)}>
              {USER_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          {isEdit && (
            <Field label="Estado" className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => update('isActive', event.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Usuario habilitado para iniciar sesión
              </label>
            </Field>
          )}
        </div>

        <section className="pt-4 border-t border-gray-200">
          <div className="flex items-start gap-2">
            <KeyRound className="w-4 h-4 text-gray-500 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Puntos de control asignados</h3>
              <p className="text-xs text-gray-500">
                {isOperator
                  ? 'El operador solo podrá registrar en los puntos marcados aquí.'
                  : 'Solo se aplica al rol operador; el resto de roles opera todos los puntos.'}
              </p>
            </div>
          </div>

          <div
            className={`mt-3 max-h-64 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100 ${
              isOperator ? '' : 'opacity-60'
            }`}
          >
            {checkpoints.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">
                Todavía no hay puntos de control creados.
              </p>
            ) : (
              checkpoints.map((checkpoint) => {
                const checked = form.checkpointIds.includes(checkpoint.id);
                return (
                  <label
                    key={checkpoint.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm cursor-pointer select-none hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!isOperator}
                        onChange={(event) =>
                          update(
                            'checkpointIds',
                            event.target.checked
                              ? [...form.checkpointIds, checkpoint.id]
                              : form.checkpointIds.filter((id) => id !== checkpoint.id),
                          )
                        }
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-gray-900 truncate">{checkpoint.name}</span>
                        <span className="block text-xs text-gray-500">
                          {checkpoint.dayLabel} · {checkpoint.windowLabel}
                        </span>
                      </span>
                    </span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{checkpoint.status.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </section>
      </form>
    </Modal>
  );
}
