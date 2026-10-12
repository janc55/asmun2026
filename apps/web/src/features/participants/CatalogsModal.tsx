'use client';

import React, { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { apiErrorMessage } from '../../lib/api';
import { Alert, Badge, Button, Field, Input, Spinner } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { participantsApi } from './participants-api';
import type { Committee, School } from './types';

export interface CatalogsModalProps {
  open: boolean;
  onClose: () => void;
  schools: School[];
  committees: Committee[];
  onChanged: () => void;
}

type Tab = 'schools' | 'committees';

export function CatalogsModal({ open, onClose, schools, committees, onChanged }: CatalogsModalProps) {
  const [tab, setTab] = useState<Tab>('schools');
  const [schoolName, setSchoolName] = useState('');
  const [schoolCity, setSchoolCity] = useState('');
  const [committeeName, setCommitteeName] = useState('');
  const [committeeShort, setCommitteeShort] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editExtra, setEditExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setEditingId(null);
    setSchoolName('');
    setSchoolCity('');
    setCommitteeName('');
    setCommitteeShort('');
  }, [open, tab]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (actionError) {
      setError(apiErrorMessage(actionError, 'No se pudo completar la operación'));
    } finally {
      setBusy(false);
    }
  };

  const addSchool = () =>
    run(async () => {
      await participantsApi.createSchool({ name: schoolName.trim(), city: schoolCity.trim() || undefined });
      setSchoolName('');
      setSchoolCity('');
    });

  const addCommittee = () =>
    run(async () => {
      await participantsApi.createCommittee({
        name: committeeName.trim(),
        shortName: committeeShort.trim() || undefined,
      });
      setCommitteeName('');
      setCommitteeShort('');
    });

  const saveEdit = (kind: Tab, id: number) =>
    run(async () => {
      if (kind === 'schools') {
        await participantsApi.updateSchool(id, { name: editName.trim(), city: editExtra.trim() || undefined });
      } else {
        await participantsApi.updateCommittee(id, {
          name: editName.trim(),
          shortName: editExtra.trim() || undefined,
        });
      }
      setEditingId(null);
    });

  const remove = (kind: Tab, id: number, label: string) => {
    if (!window.confirm(`¿Eliminar '${label}'? Solo es posible si no tiene participantes asociados.`)) return;
    run(async () => {
      if (kind === 'schools') await participantsApi.deleteSchool(id);
      else await participantsApi.deleteCommittee(id);
    });
  };

  const items = tab === 'schools' ? schools : committees;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Colegios y comités"
      description="Catálogos usados en el formulario de participantes y en la importación masiva."
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-5">
        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex gap-2 border-b border-gray-200">
          {(
            [
              { id: 'schools', label: `Colegios (${schools.length})` },
              { id: 'committees', label: `Comités (${committees.length})` },
            ] as Array<{ id: Tab; label: string }>
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-4 py-2.5 -mb-px text-sm font-medium border-b-2 transition-colors ${
                tab === item.id
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Alta */}
        <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          {tab === 'schools' ? (
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-3 items-end">
              <Field label="Nombre del colegio / delegación">
                <Input
                  value={schoolName}
                  onChange={(event) => setSchoolName(event.target.value)}
                  placeholder="Colegio San Ignacio"
                />
              </Field>
              <Field label="Ciudad">
                <Input
                  value={schoolCity}
                  onChange={(event) => setSchoolCity(event.target.value)}
                  placeholder="La Paz"
                />
              </Field>
              <Button type="button" onClick={addSchool} loading={busy} disabled={!schoolName.trim()}>
                <Plus className="w-4 h-4" />
                Agregar
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-3 items-end">
              <Field label="Nombre del comité / foro">
                <Input
                  value={committeeName}
                  onChange={(event) => setCommitteeName(event.target.value)}
                  placeholder="Consejo de Seguridad"
                />
              </Field>
              <Field label="Sigla">
                <Input
                  value={committeeShort}
                  onChange={(event) => setCommitteeShort(event.target.value)}
                  placeholder="CS"
                />
              </Field>
              <Button type="button" onClick={addCommittee} loading={busy} disabled={!committeeName.trim()}>
                <Plus className="w-4 h-4" />
                Agregar
              </Button>
            </div>
          )}
        </section>

        {/* Listado */}
        <section className="rounded-xl border border-gray-200 overflow-hidden">
          {busy && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
              <Spinner className="w-4 h-4" /> Cargando…
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500">
              Todavía no hay {tab === 'schools' ? 'colegios' : 'comités'} registrados.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((item) => {
                const isEditing = editingId === item.id;
                const extra = tab === 'schools' ? (item as School).city : (item as Committee).shortName;

                return (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    {isEditing ? (
                      <>
                        <Input
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          className="flex-1 min-w-[180px]"
                        />
                        <Input
                          value={editExtra}
                          onChange={(event) => setEditExtra(event.target.value)}
                          placeholder={tab === 'schools' ? 'Ciudad' : 'Sigla'}
                          className="w-40"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => saveEdit(tab, item.id)}
                          loading={busy}
                          disabled={!editName.trim()}
                        >
                          <Check className="w-4 h-4" />
                          Guardar
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-[180px]">
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                          {extra && <div className="text-xs text-gray-500">{extra}</div>}
                        </div>
                        <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                          {item.participantsCount} participante(s)
                        </Badge>
                        <button
                          type="button"
                          aria-label="Editar"
                          title="Editar"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditName(item.name);
                            setEditExtra(extra ?? '');
                          }}
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Eliminar"
                          title="Eliminar"
                          onClick={() => remove(tab, item.id, item.name)}
                          className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}
