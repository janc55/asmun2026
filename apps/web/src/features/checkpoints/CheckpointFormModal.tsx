'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { apiErrorMessage } from '../../lib/api';
import { timeFromIso, toEventIso, todayInEventZone } from '../../lib/datetime';
import { Alert, Button, Field, Input, Select } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { ROLE_OPTIONS, roleLabel } from '../participants/role-styles';
import { checkpointsApi } from './checkpoints-api';
import { CHECKPOINT_TYPE_OPTIONS, Checkpoint, CheckpointType } from './types';

export interface CheckpointFormModalProps {
  open: boolean;
  onClose: () => void;
  /** `null` crea un punto nuevo. */
  checkpoint: Checkpoint | null;
  /** Todos los puntos, para elegir la dependencia. */
  checkpoints: Checkpoint[];
  /** Día sugerido al crear (por defecto el de hoy del evento). */
  defaultDay?: string;
  onSaved: () => void;
}

interface FormState {
  name: string;
  type: CheckpointType;
  day: string;
  wholeDay: boolean;
  startTime: string;
  endTime: string;
  requiresCheckpointId: string;
  roles: string[];
  isActive: boolean;
}

export function CheckpointFormModal({
  open,
  onClose,
  checkpoint,
  checkpoints,
  defaultDay,
  onSaved,
}: CheckpointFormModalProps) {
  const isEdit = Boolean(checkpoint);
  const [form, setForm] = useState<FormState>({
    name: '',
    type: 'ingreso',
    day: defaultDay ?? todayInEventZone(),
    wholeDay: true,
    startTime: '08:00',
    endTime: '12:00',
    requiresCheckpointId: '',
    roles: [],
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);

    if (checkpoint) {
      setForm({
        name: checkpoint.name,
        type: checkpoint.type,
        day: checkpoint.day,
        wholeDay: !checkpoint.startsAt && !checkpoint.endsAt,
        startTime: timeFromIso(checkpoint.startsAt) || '08:00',
        endTime: timeFromIso(checkpoint.endsAt) || '12:00',
        requiresCheckpointId: checkpoint.requiresCheckpointId ? String(checkpoint.requiresCheckpointId) : '',
        roles: checkpoint.appliesToRoles ?? [],
        isActive: checkpoint.isActive,
      });
    } else {
      setForm({
        name: '',
        type: 'ingreso',
        day: defaultDay ?? todayInEventZone(),
        wholeDay: true,
        startTime: '08:00',
        endTime: '12:00',
        requiresCheckpointId: '',
        roles: [],
        isActive: true,
      });
    }
  }, [open, checkpoint, defaultDay]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const dependencyOptions = useMemo(
    () =>
      checkpoints.filter(
        (item) => item.id !== checkpoint?.id && item.day <= form.day,
      ),
    [checkpoints, checkpoint?.id, form.day],
  );

  const windowError = useMemo(() => {
    if (form.wholeDay) return null;
    if (!form.startTime) return 'Indique la hora de inicio de la ventana.';
    if (form.endTime && form.startTime >= form.endTime) {
      return 'La hora de inicio debe ser anterior a la de fin.';
    }
    return null;
  }, [form.wholeDay, form.startTime, form.endTime]);

  const canSubmit = form.name.trim().length >= 2 && Boolean(form.day) && !windowError && !saving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      type: form.type,
      day: form.day,
      startsAt: form.wholeDay || !form.startTime ? null : toEventIso(form.day, form.startTime),
      endsAt: form.wholeDay || !form.endTime ? null : toEventIso(form.day, form.endTime),
      requiresCheckpointId: form.requiresCheckpointId ? Number(form.requiresCheckpointId) : null,
      appliesToRoles: form.roles.length > 0 ? (form.roles as any) : null,
      isActive: form.isActive,
    };

    try {
      if (isEdit) {
        await checkpointsApi.update(checkpoint!.id, payload);
      } else {
        await checkpointsApi.create(payload);
      }
      onSaved();
      onClose();
    } catch (submitError) {
      setError(apiErrorMessage(submitError, 'No se pudo guardar el punto de control'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar punto de control' : 'Nuevo punto de control'}
      description="Cada punto se registra una sola vez por persona y por día (RF-09)."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="checkpoint-form" loading={saving} disabled={!canSubmit}>
            <Save className="w-4 h-4" />
            {isEdit ? 'Guardar cambios' : 'Crear punto'}
          </Button>
        </>
      }
    >
      <form id="checkpoint-form" onSubmit={handleSubmit} className="space-y-5">
        {error && <Alert variant="error">{error}</Alert>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nombre del punto" required htmlFor="cp-name" className="sm:col-span-2">
            <Input
              id="cp-name"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="Almuerzo día 1"
              required
            />
          </Field>

          <Field label="Tipo" required htmlFor="cp-type">
            <Select
              id="cp-type"
              value={form.type}
              onChange={(event) => update('type', event.target.value as CheckpointType)}
            >
              {CHECKPOINT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Día del evento" required htmlFor="cp-day" hint="Cada día es un punto distinto">
            <Input
              id="cp-day"
              type="date"
              value={form.day}
              onChange={(event) => update('day', event.target.value)}
              required
            />
          </Field>

          <Field label="Ventana horaria">
            <div className="flex items-center gap-2 min-h-[44px]">
              <input
                id="cp-wholeday"
                type="checkbox"
                checked={form.wholeDay}
                onChange={(event) => update('wholeDay', event.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="cp-wholeday" className="text-sm text-gray-700">
                Todo el día (sin restricción de horario)
              </label>
            </div>
          </Field>

          {!form.wholeDay && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Desde" htmlFor="cp-start">
                <Input
                  id="cp-start"
                  type="time"
                  value={form.startTime}
                  onChange={(event) => update('startTime', event.target.value)}
                />
              </Field>
              <Field label="Hasta" htmlFor="cp-end" error={windowError}>
                <Input
                  id="cp-end"
                  type="time"
                  value={form.endTime}
                  onChange={(event) => update('endTime', event.target.value)}
                />
              </Field>
            </div>
          )}

          <Field
            label="Depende de"
            htmlFor="cp-dependency"
            hint="El punto que debe estar cumplido antes (por ejemplo, material tras la credencial)"
            className="sm:col-span-2"
          >
            <Select
              id="cp-dependency"
              value={form.requiresCheckpointId}
              onChange={(event) => update('requiresCheckpointId', event.target.value)}
            >
              <option value="">Sin dependencia</option>
              {dependencyOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.dayLabel}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Roles habilitados"
            hint="Sin selección, el punto aplica a todos los roles"
            className="sm:col-span-2"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ROLE_OPTIONS.map((option) => {
                const checked = form.roles.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm cursor-pointer select-none transition-colors ${
                      checked ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        update(
                          'roles',
                          event.target.checked
                            ? [...form.roles, option.value]
                            : form.roles.filter((role) => role !== option.value),
                        )
                      }
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    {roleLabel(option.value)}
                  </label>
                );
              })}
            </div>
          </Field>

          {isEdit && (
            <Field label="Estado del punto" className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => update('isActive', event.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Punto habilitado para registrar
              </label>
            </Field>
          )}
        </div>
      </form>
    </Modal>
  );
}
