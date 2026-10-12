'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { apiErrorMessage, saveBlob } from '../../lib/api';
import { Alert, Badge, Button, Field, Input, Select } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { participantsApi } from './participants-api';
import { ROLE_OPTIONS, roleLabel } from './role-styles';
import type { ImportReport, ImportRowResult } from './types';

export interface ImportWizardModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const MAX_VISIBLE_ROWS = 300;

export function ImportWizardModal({ open, onClose, onImported }: ImportWizardModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [createMissingCatalogs, setCreateMissingCatalogs] = useState(true);
  const [defaultRole, setDefaultRole] = useState('');
  const [defaultSchoolName, setDefaultSchoolName] = useState('');
  const [onlyProblems, setOnlyProblems] = useState(true);
  const [preview, setPreview] = useState<ImportReport | null>(null);
  const [confirmed, setConfirmed] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setPreview(null);
    setConfirmed(null);
    setError(null);
    setOnlyProblems(true);
    setCreateMissingCatalogs(true);
  }, [open]);

  const visibleRows = useMemo<ImportRowResult[]>(() => {
    if (!preview) return [];
    const rows = onlyProblems ? preview.rows.filter((row) => row.status === 'error') : preview.rows;
    return rows.slice(0, MAX_VISIBLE_ROWS);
  }, [preview, onlyProblems]);

  const runImport = async (confirm: boolean) => {
    if (!file) {
      setError('Seleccione el archivo de Excel o CSV antes de continuar.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const report = await participantsApi.importFile(file, {
        confirm,
        createMissingCatalogs,
        defaultRole: defaultRole || undefined,
        defaultSchoolName: defaultSchoolName || undefined,
      });

      if (confirm) {
        setConfirmed(report);
        setPreview(report);
        onImported();
      } else {
        setPreview(report);
        setConfirmed(null);
      }
    } catch (importError) {
      setError(apiErrorMessage(importError, 'No se pudo procesar el archivo'));
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const blob = await participantsApi.importTemplate();
      saveBlob(blob, 'plantilla_participantes.xlsx');
    } catch (templateError) {
      setError(apiErrorMessage(templateError, 'No se pudo descargar la plantilla'));
    }
  };

  const report = confirmed ?? preview;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Importar participantes desde Excel o CSV"
      description="Los encabezados del archivo se reconocen de forma tolerante (Nombre/Nombres, Colegio/Delegación, etc.)."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={downloadTemplate} disabled={busy}>
            <Download className="w-4 h-4" />
            Descargar plantilla
          </Button>
          <div className="flex-1" />
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cerrar
          </Button>
          {!confirmed && (
            <Button type="button" variant="secondary" onClick={() => runImport(false)} loading={busy} disabled={!file}>
              <FileSpreadsheet className="w-4 h-4" />
              Analizar archivo
            </Button>
          )}
          {preview && preview.summary.validRows > 0 && !confirmed && (
            <Button type="button" onClick={() => runImport(true)} loading={busy}>
              <Upload className="w-4 h-4" />
              Confirmar importación ({preview.summary.validRows})
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        {error && <Alert variant="error">{error}</Alert>}

        {confirmed && (
          <Alert variant="success">
            <div className="font-semibold">
              Importación confirmada: {confirmed.summary.created} participante(s) creado(s) de{' '}
              {confirmed.summary.totalRows} fila(s) leída(s).
            </div>
            {confirmed.summary.failed > 0 && (
              <div className="mt-1">
                {confirmed.summary.failed} fila(s) no se guardaron; revise el detalle más abajo.
              </div>
            )}
          </Alert>
        )}

        {/* Paso 1: archivo y opciones */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Field label="Archivo (.xlsx o .csv)" required>
              <label
                htmlFor="import-file"
                className="flex flex-col items-center justify-center gap-2 w-full min-h-[120px] px-4 py-6 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-primary-50 hover:border-primary-300 cursor-pointer transition-colors"
              >
                <Upload className="w-6 h-6 text-primary-600" />
                <span className="text-sm font-medium text-gray-700">
                  {file ? file.name : 'Toque para elegir el archivo de la lista de inscritos'}
                </span>
                {file && (
                  <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} KB</span>
                )}
              </label>
              <input
                id="import-file"
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setPreview(null);
                  setConfirmed(null);
                  setError(null);
                }}
              />
            </Field>
          </div>

          <div className="space-y-4">
            <Field label="Rol por defecto" hint="Se usa solo si el archivo no trae columna de rol">
              <Select value={defaultRole} onChange={(event) => setDefaultRole(event.target.value)}>
                <option value="">Delegado (predeterminado)</option>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Colegio por defecto" hint="Se usa solo si el archivo no trae columna de colegio">
              <Input
                value={defaultSchoolName}
                onChange={(event) => setDefaultSchoolName(event.target.value)}
                placeholder="Ej. Colegio Americano de Oruro"
              />
            </Field>

            <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={createMissingCatalogs}
                onChange={(event) => setCreateMissingCatalogs(event.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Crear colegios y comités que no existan
            </label>
          </div>
        </section>

        {/* Paso 2: vista previa */}
        {report && (
          <>
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Filas leídas" value={report.summary.totalRows} />
              <Stat label="Filas válidas" value={report.summary.validRows} tone="ok" />
              <Stat label="Con errores" value={report.summary.invalidRows} tone={report.summary.invalidRows ? 'error' : undefined} />
              <Stat
                label={confirmed ? 'Guardadas' : 'Por guardar'}
                value={confirmed ? report.summary.created : report.summary.validRows}
                tone="primary"
              />
            </section>

            <section className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 space-y-1">
              <div>
                <span className="font-medium">Hoja:</span> {report.sheetName} ·{' '}
                <span className="font-medium">Fila de encabezados:</span> {report.headerRow} ·{' '}
                <span className="font-medium">Modo:</span> {report.mode === 'confirmed' ? 'confirmado' : 'vista previa'}
              </div>
              <div>
                <span className="font-medium">Columnas reconocidas:</span>{' '}
                {report.detectedColumns.map((column) => `${column.header} → ${column.label}`).join(' · ') || '—'}
              </div>
              {report.unknownColumns.length > 0 && (
                <div>
                  <span className="font-medium">Columnas ignoradas:</span> {report.unknownColumns.join(', ')}
                </div>
              )}
              {report.summary.schoolsToCreate.length > 0 && (
                <div>
                  <span className="font-medium">Colegios {confirmed ? 'creados' : 'a crear'}:</span>{' '}
                  {report.summary.schoolsToCreate.join(', ')}
                </div>
              )}
              {report.summary.committeesToCreate.length > 0 && (
                <div>
                  <span className="font-medium">Comités {confirmed ? 'creados' : 'a crear'}:</span>{' '}
                  {report.summary.committeesToCreate.join(', ')}
                </div>
              )}
              {report.summary.possibleDuplicates > 0 && (
                <div className="flex items-center gap-1.5 text-amber-700">
                  <AlertTriangle className="w-4 h-4" />
                  {report.summary.possibleDuplicates} posible(s) duplicado(s) por nombre y apellido.
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  Detalle por fila ({report.rows.length})
                </h3>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyProblems}
                    onChange={(event) => setOnlyProblems(event.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Mostrar solo filas con problemas
                </label>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Fila</th>
                      <th className="px-3 py-2 text-left font-medium">Nombre</th>
                      <th className="px-3 py-2 text-left font-medium">Rol</th>
                      <th className="px-3 py-2 text-left font-medium">Colegio / Comité</th>
                      <th className="px-3 py-2 text-left font-medium">Estado</th>
                      <th className="px-3 py-2 text-left font-medium">Mensajes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleRows.map((row) => (
                      <tr key={`${row.row}-${row.data.firstName}`} className="align-top">
                        <td className="px-3 py-2 text-gray-500">{row.row}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {row.data.firstName} {row.data.lastName}
                          {row.code && (
                            <span className="ml-2 font-mono text-xs text-gray-500">{row.code}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700">{roleLabel(row.data.role)}</td>
                        <td className="px-3 py-2 text-gray-700">
                          {row.data.school ?? '—'}
                          {row.data.committee ? ` · ${row.data.committee}` : ''}
                        </td>
                        <td className="px-3 py-2">
                          {row.status === 'ok' ? (
                            <Badge className="bg-green-50 text-green-700 border-green-200">
                              <CheckCircle2 className="w-3 h-3" /> Válida
                            </Badge>
                          ) : (
                            <Badge className="bg-red-50 text-red-700 border-red-200">
                              <AlertTriangle className="w-3 h-3" /> Error
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {row.errors.map((message) => (
                            <div key={message} className="text-red-600">
                              {message}
                            </div>
                          ))}
                          {row.warnings.map((message) => (
                            <div key={message} className="text-amber-600">
                              {message}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                    {visibleRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                          {onlyProblems ? 'No hay filas con errores. ' : 'Sin filas para mostrar. '}
                          {report.summary.validRows > 0 && !confirmed
                            ? 'Confirme la importación para guardar las filas válidas.'
                            : ''}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {report.rows.length > MAX_VISIBLE_ROWS && (
                <p className="mt-2 text-xs text-gray-500">
                  Se muestran las primeras {MAX_VISIBLE_ROWS} filas de {report.rows.length}.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'ok' | 'error' | 'primary';
}) {
  const toneClass =
    tone === 'ok'
      ? 'text-status-ok'
      : tone === 'error'
        ? 'text-status-error'
        : tone === 'primary'
          ? 'text-primary-600'
          : 'text-gray-900';

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
