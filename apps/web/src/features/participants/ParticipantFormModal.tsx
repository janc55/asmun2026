'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Printer, Save, ShieldCheck } from 'lucide-react';
import { apiErrorMessage, openBlob } from '../../lib/api';
import { Alert, Badge, Button, Field, Input, Select, Spinner, Textarea } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { participantsApi } from './participants-api';
import { ROLE_OPTIONS, formatDateTime, formatShortCode } from './role-styles';
import type {
  Committee,
  Participant,
  ParticipantDetail,
  ParticipantInput,
  ParticipantRole,
  School,
} from './types';

interface FormState {
  firstName: string;
  lastName: string;
  role: ParticipantRole;
  documentId: string;
  position: string;
  schoolId: string;
  committeeId: string;
  country: string;
  dietaryNotes: string;
  notes: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  firstName: '',
  lastName: '',
  role: 'delegado',
  documentId: '',
  position: '',
  schoolId: '',
  committeeId: '',
  country: '',
  dietaryNotes: '',
  notes: '',
  isActive: true,
};

export interface ParticipantFormModalProps {
  open: boolean;
  onClose: () => void;
  /** `null` crea un participante; un valor edita el existente. */
  participant: Participant | null;
  /** `quick` es el registro en sitio: pocos campos y botón "Guardar e imprimir". */
  variant?: 'full' | 'quick';
  /** Solo consulta (rol `lector`): sin guardado y con los campos deshabilitados. */
  readOnly?: boolean;
  schools: School[];
  committees: Committee[];
  onSaved: (participant: Participant) => void;
}

export function ParticipantFormModal({
  open,
  onClose,
  participant,
  variant = 'full',
  readOnly = false,
  schools,
  committees,
  onSaved,
}: ParticipantFormModalProps) {
  const isQuick = variant === 'quick';
  const isEdit = Boolean(participant);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [printAfterSave, setPrintAfterSave] = useState(isQuick);
  const [detail, setDetail] = useState<ParticipantDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Participant | null>(null);

  useEffect(() => {
    if (!open) return;

    setError(null);
    setCreated(null);
    setPrintAfterSave(isQuick);

    if (participant) {
      setForm({
        firstName: participant.firstName,
        lastName: participant.lastName,
        role: participant.role,
        documentId: participant.documentId ?? '',
        position: participant.position ?? '',
        schoolId: participant.school ? String(participant.school.id) : '',
        committeeId: participant.committee ? String(participant.committee.id) : '',
        country: participant.country ?? '',
        dietaryNotes: participant.dietaryNotes ?? '',
        notes: participant.notes ?? '',
        isActive: participant.isActive,
      });

      // El detalle trae el historial de escaneos (RF-16).
      setLoadingDetail(true);
      participantsApi
        .detail(participant.id)
        .then(setDetail)
        .catch(() => setDetail(null))
        .finally(() => setLoadingDetail(false));
    } else {
      setForm(EMPTY_FORM);
      setDetail(null);
    }
  }, [open, participant, isQuick]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const canSubmit = useMemo(
    () => form.firstName.trim().length > 0 && form.lastName.trim().length > 0 && !saving,
    [form.firstName, form.lastName, saving],
  );

  const printBadge = async (participantId: number, reprint: boolean) => {
    const blob = await participantsApi.badgePdf(participantId, {
      format: 'card',
      reprint,
      reason: reprint ? 'Reimpresión desde la ficha del participante' : undefined,
    });
    openBlob(blob);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError(null);

    const payload: ParticipantInput = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      role: form.role,
      documentId: form.documentId.trim(),
      position: form.position.trim(),
      schoolId: form.schoolId ? Number(form.schoolId) : null,
      committeeId: form.committeeId ? Number(form.committeeId) : null,
      country: form.country.trim(),
      dietaryNotes: form.dietaryNotes.trim(),
      notes: form.notes.trim(),
    };

    if (isEdit) payload.isActive = form.isActive;

    try {
      const saved = isEdit
        ? await participantsApi.update(participant!.id, payload)
        : await participantsApi.create(payload);

      setCreated(saved);
      onSaved(saved);

      if (printAfterSave) {
        try {
          await printBadge(saved.id, false);
        } catch (printError) {
          setError(
            `El participante se guardó, pero no se pudo generar la credencial: ${apiErrorMessage(printError)}`,
          );
          setSaving(false);
          return;
        }
      }

      if (isQuick || printAfterSave) {
        // En registro rápido se vuelve a la tabla con el código a la vista.
        window.setTimeout(() => onClose(), 900);
      }
    } catch (submitError) {
      setError(apiErrorMessage(submitError, 'No se pudo guardar el participante'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size={isQuick ? 'md' : 'lg'}
      title={
        readOnly
          ? 'Ficha del participante'
          : isEdit
            ? 'Editar participante'
            : isQuick
              ? 'Registro rápido en sitio'
              : 'Nuevo participante'
      }
      description={
        isEdit
          ? `Código ${formatShortCode(participant?.code)} · el código no cambia al editar`
          : 'El sistema asigna automáticamente un código corto único de 6 caracteres.'
      }
      footer={
        readOnly ? (
          <Button type="button" variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cerrar
            </Button>
            <Button type="submit" form="participant-form" loading={saving} disabled={!canSubmit}>
              {printAfterSave ? <Printer className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {isEdit
                ? 'Guardar cambios'
                : printAfterSave
                  ? 'Guardar e imprimir credencial'
                  : 'Guardar participante'}
            </Button>
          </>
        )
      }
    >
      <form id="participant-form" onSubmit={handleSubmit} className="space-y-5">
        {error && <Alert variant="error">{error}</Alert>}

        {created && (
          <Alert variant="success">
            <div className="font-semibold">
              {created.firstName} {created.lastName} guardado correctamente.
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span>Código asignado:</span>
              <span className="font-mono text-base font-bold tracking-wider">
                {formatShortCode(created.code)}
              </span>
            </div>
          </Alert>
        )}

        <fieldset disabled={readOnly} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nombres" required htmlFor="firstName">
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(event) => update('firstName', event.target.value)}
              placeholder="Ana María"
              autoComplete="off"
              required
            />
          </Field>

          <Field label="Apellidos" required htmlFor="lastName">
            <Input
              id="lastName"
              value={form.lastName}
              onChange={(event) => update('lastName', event.target.value)}
              placeholder="Quispe Mamani"
              autoComplete="off"
              required
            />
          </Field>

          <Field label="Rol" required htmlFor="role">
            <Select id="role" value={form.role} onChange={(event) => update('role', event.target.value as ParticipantRole)}>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Colegio / Delegación" htmlFor="schoolId">
            <Select id="schoolId" value={form.schoolId} onChange={(event) => update('schoolId', event.target.value)}>
              <option value="">Sin colegio asignado</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Comité / Foro" htmlFor="committeeId">
            <Select
              id="committeeId"
              value={form.committeeId}
              onChange={(event) => update('committeeId', event.target.value)}
            >
              <option value="">Sin comité asignado</option>
              {committees.map((committee) => (
                <option key={committee.id} value={committee.id}>
                  {committee.name}
                  {committee.shortName ? ` (${committee.shortName})` : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="País que representa" htmlFor="country">
            <Input
              id="country"
              value={form.country}
              onChange={(event) => update('country', event.target.value)}
              placeholder="Brasil"
              autoComplete="off"
            />
          </Field>

          {!isQuick && (
            <>
              <Field label="Cargo" hint="Solo para quienes tienen cargo (mesa, secretaría, docentes)" htmlFor="position">
                <Input
                  id="position"
                  value={form.position}
                  onChange={(event) => update('position', event.target.value)}
                  placeholder="Presidente"
                  autoComplete="off"
                />
              </Field>

              <Field label="Documento de identidad" hint="No se imprime en la credencial" htmlFor="documentId">
                <Input
                  id="documentId"
                  value={form.documentId}
                  onChange={(event) => update('documentId', event.target.value)}
                  placeholder="Opcional"
                  autoComplete="off"
                />
              </Field>
            </>
          )}

          <Field
            label="Restricciones alimentarias"
            hint="Se muestra como alerta en los puntos de refrigerio y almuerzo"
            htmlFor="dietaryNotes"
            className={isQuick ? 'sm:col-span-2' : undefined}
          >
            <Input
              id="dietaryNotes"
              value={form.dietaryNotes}
              onChange={(event) => update('dietaryNotes', event.target.value)}
              placeholder="Celíaco, vegetariano, alergia a frutos secos…"
              autoComplete="off"
            />
          </Field>

          {!isQuick && (
            <Field label="Observaciones" htmlFor="notes" className="sm:col-span-2">
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(event) => update('notes', event.target.value)}
                placeholder="Información interna (no se imprime)"
              />
            </Field>
          )}
        </fieldset>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-5 pt-1 border-t border-gray-100">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={printAfterSave}
              onChange={(event) => setPrintAfterSave(event.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <Printer className="w-4 h-4 text-gray-500" />
            {isEdit ? 'Abrir credencial al guardar' : 'Guardar e imprimir credencial'}
          </label>

          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => update('isActive', event.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <ShieldCheck className="w-4 h-4 text-gray-500" />
              Participante habilitado
            </label>
          )}
          </div>
        )}

        {isEdit && (
          <section className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Historial de control</h3>
            {loadingDetail ? (
              <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
                <Spinner className="w-4 h-4" /> Cargando historial…
              </div>
            ) : detail && detail.scans.length > 0 ? (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                {detail.scans.map((scan) => (
                  <li key={scan.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{scan.checkpoint.name}</div>
                      <div className="text-xs text-gray-500">
                        {formatDateTime(scan.scannedAt)} · {scan.user.fullName}
                      </div>
                    </div>
                    <Badge
                      className={
                        scan.result === 'ok' || scan.result === 'excepcion'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : scan.result === 'duplicado' || scan.result === 'anulado'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                      }
                    >
                      {scan.result.replace(/_/g, ' ')}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">
                Aún no hay escaneos registrados para este participante.
              </p>
            )}
          </section>
        )}
      </form>
    </Modal>
  );
}
