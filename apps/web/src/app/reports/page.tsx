'use client';

import React, { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, Users, Utensils } from 'lucide-react';
import { useAuth } from '../../context/auth-context';
import { apiErrorMessage, saveBlob } from '../../lib/api';
import { todayInEventZone } from '../../lib/datetime';
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../../components/ui/primitives';
import { checkpointsApi } from '../../features/checkpoints/checkpoints-api';
import type { Checkpoint } from '../../features/checkpoints/types';
import { ROLE_OPTIONS } from '../../features/participants/role-styles';
import { participantsApi } from '../../features/participants/participants-api';
import type { Committee, School } from '../../features/participants/types';
import { reportsApi } from '../../features/reports/reports-api';
import { SCAN_RESULT_OPTIONS } from '../../features/audit/types';

export default function ReportsPage() {
  const { user, isLoading, hasRole } = useAuth();
  const canRead = hasRole('admin', 'lector');

  const [schools, setSchools] = useState<School[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filtros de participantes
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantSchool, setParticipantSchool] = useState('');
  const [participantCommittee, setParticipantCommittee] = useState('');
  const [participantRole, setParticipantRole] = useState('');
  const [participantActive, setParticipantActive] = useState('');

  // Filtros de escaneos
  const [scanFrom, setScanFrom] = useState(todayInEventZone());
  const [scanTo, setScanTo] = useState(todayInEventZone());
  const [scanCheckpoint, setScanCheckpoint] = useState('');
  const [scanResult, setScanResult] = useState('');
  const [scanSearch, setScanSearch] = useState('');

  // Filtros de pendientes
  const [pendingCheckpoint, setPendingCheckpoint] = useState('');
  const [pendingSchool, setPendingSchool] = useState('');

  useEffect(() => {
    if (!canRead) return;
    Promise.all([participantsApi.schools(), participantsApi.committees(), checkpointsApi.list()])
      .then(([schoolList, committeeList, checkpointList]) => {
        setSchools(schoolList.data);
        setCommittees(committeeList.data);
        setCheckpoints(checkpointList.data);
        if (checkpointList.data.length > 0) setPendingCheckpoint(String(checkpointList.data[0].id));
      })
      .catch(() => undefined);
  }, [canRead]);

  const run = async (label: string, action: () => Promise<{ blob: Blob; filename: string | null; rowCount: number | null }>) => {
    setBusy(label);
    setError(null);
    setNotice(null);

    try {
      const download = await action();
      saveBlob(download.blob, download.filename ?? 'reporte.xlsx');
      setNotice(
        download.rowCount !== null
          ? `${label}: ${download.rowCount} fila(s) exportadas.`
          : `${label}: archivo generado.`,
      );
    } catch (downloadError) {
      setError(apiErrorMessage(downloadError, 'No se pudo generar el reporte'));
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) {
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
          Su rol ({user.role}) no tiene acceso a los reportes.
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reportes</h1>
        <p className="text-sm text-gray-600">
          Descargas en Excel (.xlsx) con los filtros aplicados. Las fechas se exportan en la hora del evento
          (America/La_Paz).
        </p>
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

      {/* Participantes */}
      <Card className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Participantes</h2>
            <p className="text-sm text-gray-600">
              Nómina completa con código corto, colegio, comité, restricciones alimentarias y estado.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Búsqueda">
            <Input
              value={participantSearch}
              onChange={(event) => setParticipantSearch(event.target.value)}
              placeholder="Nombre, apellido, código o documento"
            />
          </Field>
          <Field label="Colegio">
            <Select value={participantSchool} onChange={(event) => setParticipantSchool(event.target.value)}>
              <option value="">Todos</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Comité">
            <Select value={participantCommittee} onChange={(event) => setParticipantCommittee(event.target.value)}>
              <option value="">Todos</option>
              {committees.map((committee) => (
                <option key={committee.id} value={committee.id}>
                  {committee.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Rol">
            <Select value={participantRole} onChange={(event) => setParticipantRole(event.target.value)}>
              <option value="">Todos</option>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estado">
            <Select value={participantActive} onChange={(event) => setParticipantActive(event.target.value)}>
              <option value="">Todos</option>
              <option value="true">Solo activos</option>
              <option value="false">Solo desactivados</option>
            </Select>
          </Field>
        </div>

        <Button
          type="button"
          loading={busy === 'Participantes'}
          disabled={busy !== null}
          onClick={() =>
            run('Participantes', () =>
              reportsApi.participants({
                search: participantSearch.trim() || undefined,
                schoolId: participantSchool ? Number(participantSchool) : '',
                committeeId: participantCommittee ? Number(participantCommittee) : '',
                role: participantRole || undefined,
                isActive: participantActive === '' ? '' : participantActive === 'true',
              }),
            )
          }
        >
          <Download className="w-4 h-4" />
          Descargar participantes.xlsx
        </Button>
      </Card>

      {/* Escaneos */}
      <Card className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Escaneos</h2>
            <p className="text-sm text-gray-600">
              Historial cronológico con hora, punto, resultado, operador y anulaciones. Incluye los intentos
              rechazados (duplicados, fuera de horario, etc.).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Desde">
            <Input type="date" value={scanFrom} onChange={(event) => setScanFrom(event.target.value)} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={scanTo} onChange={(event) => setScanTo(event.target.value)} />
          </Field>
          <Field label="Punto de control">
            <Select value={scanCheckpoint} onChange={(event) => setScanCheckpoint(event.target.value)}>
              <option value="">Todos</option>
              {checkpoints.map((checkpoint) => (
                <option key={checkpoint.id} value={checkpoint.id}>
                  {checkpoint.name} · {checkpoint.dayLabel}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Resultado">
            <Select value={scanResult} onChange={(event) => setScanResult(event.target.value)}>
              <option value="">Todos</option>
              {SCAN_RESULT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Participante" hint="Nombre, apellido, código o documento">
            <Input
              value={scanSearch}
              onChange={(event) => setScanSearch(event.target.value)}
              placeholder="Ej. Ana Quispe"
            />
          </Field>
        </div>

        <Button
          type="button"
          loading={busy === 'Escaneos'}
          disabled={busy !== null}
          onClick={() =>
            run('Escaneos', () =>
              reportsApi.scans({
                from: scanFrom || undefined,
                to: scanTo || undefined,
                checkpointId: scanCheckpoint ? Number(scanCheckpoint) : '',
                result: scanResult || undefined,
                search: scanSearch.trim() || undefined,
              }),
            )
          }
        >
          <Download className="w-4 h-4" />
          Descargar escaneos.xlsx
        </Button>
      </Card>

      {/* Pendientes (catering) */}
      <Card className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center flex-shrink-0">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Pendientes de un punto</h2>
            <p className="text-sm text-gray-600">
              Quiénes faltan en un punto de control, con sus restricciones alimentarias destacadas. Pensado
              para catering y acreditación.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Punto de control" required>
            <Select value={pendingCheckpoint} onChange={(event) => setPendingCheckpoint(event.target.value)}>
              <option value="">Elija un punto</option>
              {checkpoints.map((checkpoint) => (
                <option key={checkpoint.id} value={checkpoint.id}>
                  {checkpoint.name} · {checkpoint.dayLabel} ({checkpoint.scansCount} registros)
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Colegio">
            <Select value={pendingSchool} onChange={(event) => setPendingSchool(event.target.value)}>
              <option value="">Todos</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Button
          type="button"
          loading={busy === 'Pendientes'}
          disabled={busy !== null || !pendingCheckpoint}
          onClick={() =>
            run('Pendientes', () =>
              reportsApi.pending({
                checkpointId: Number(pendingCheckpoint),
                schoolId: pendingSchool ? Number(pendingSchool) : '',
              }),
            )
          }
        >
          <Download className="w-4 h-4" />
          Descargar pendientes.xlsx
        </Button>
      </Card>
    </div>
  );
}
