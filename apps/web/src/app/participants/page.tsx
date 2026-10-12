'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Upload,
  UserPlus,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/auth-context';
import { apiErrorMessage, openBlob, saveBlob } from '../../lib/api';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Select,
  Spinner,
} from '../../components/ui/primitives';
import { ParticipantFormModal } from '../../features/participants/ParticipantFormModal';
import { ImportWizardModal } from '../../features/participants/ImportWizardModal';
import { CatalogsModal } from '../../features/participants/CatalogsModal';
import { participantsApi } from '../../features/participants/participants-api';
import {
  ROLE_OPTIONS,
  formatShortCode,
  roleBadgeClasses,
  roleLabel,
} from '../../features/participants/role-styles';
import type { Committee, PaginationMeta, Participant, School } from '../../features/participants/types';

const EMPTY_META: PaginationMeta = { total: 0, page: 1, limit: 25, totalPages: 0 };

export default function ParticipantsPage() {
  const { user, isLoading: isAuthLoading, hasRole } = useAuth();
  const canWrite = hasRole('admin', 'registrador');
  const canRead = hasRole('admin', 'registrador', 'lector');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [committeeId, setCommitteeId] = useState('');
  const [role, setRole] = useState('');
  const [isActive, setIsActive] = useState('true');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<Participant[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [schools, setSchools] = useState<School[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [formParticipant, setFormParticipant] = useState<Participant | null>(null);
  const [formVariant, setFormVariant] = useState<'full' | 'quick'>('full');
  const [importOpen, setImportOpen] = useState(false);
  const [catalogsOpen, setCatalogsOpen] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Búsqueda instantánea con retardo corto para no golpear la API por tecla.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadCatalogs = useCallback(async () => {
    try {
      const [schoolList, committeeList] = await Promise.all([
        participantsApi.schools(),
        participantsApi.committees(),
      ]);
      setSchools(schoolList.data);
      setCommittees(committeeList.data);
    } catch {
      // Los catálogos son auxiliares: si fallan, la tabla sigue siendo utilizable.
    }
  }, []);

  const loadParticipants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await participantsApi.list({
        search,
        schoolId: schoolId ? Number(schoolId) : '',
        committeeId: committeeId ? Number(committeeId) : '',
        role,
        isActive: isActive === '' ? '' : isActive === 'true',
        page,
        limit: 25,
      });
      setRows(result.data);
      setMeta(result.meta);
    } catch (loadError) {
      setError(apiErrorMessage(loadError, 'No se pudo cargar la lista de participantes'));
      setRows([]);
      setMeta(EMPTY_META);
    } finally {
      setLoading(false);
    }
  }, [search, schoolId, committeeId, role, isActive, page]);

  useEffect(() => {
    if (!user || !canRead) return;
    loadCatalogs();
  }, [user, canRead, loadCatalogs]);

  useEffect(() => {
    if (!user || !canRead) return;
    loadParticipants();
  }, [user, canRead, loadParticipants]);

  const openCreate = (variant: 'full' | 'quick') => {
    setFormParticipant(null);
    setFormVariant(variant);
    setFormOpen(true);
  };

  const openEdit = (participant: Participant) => {
    setFormParticipant(participant);
    setFormVariant('full');
    setFormOpen(true);
  };

  const onSaved = (participant: Participant) => {
    setNotice(
      `${participant.firstName} ${participant.lastName} · código ${formatShortCode(participant.code)}`,
    );
    loadParticipants();
    loadCatalogs();
  };

  const printBadge = async (participant: Participant, reprint: boolean) => {
    try {
      let reason: string | undefined;
      if (reprint) {
        const answer = window.prompt(
          `Motivo de la reimpresión de la credencial de ${participant.firstName} ${participant.lastName}:`,
          'Credencial perdida o deteriorada',
        );
        if (answer === null) return;
        reason = answer;
      }

      const blob = await participantsApi.badgePdf(participant.id, { format: 'card', reprint, reason });
      openBlob(blob);
      setNotice(
        reprint
          ? `Reimpresión de ${participant.firstName} ${participant.lastName} registrada en auditoría.`
          : `Credencial de ${participant.firstName} ${participant.lastName} generada.`,
      );
    } catch (printError) {
      setError(apiErrorMessage(printError, 'No se pudo generar la credencial'));
    }
  };

  const printBatch = async (reprint: boolean) => {
    setPrinting(true);
    setError(null);

    const filters = {
      search: search || undefined,
      schoolId: schoolId ? Number(schoolId) : undefined,
      committeeId: committeeId ? Number(committeeId) : undefined,
      role: role || undefined,
      isActive: isActive === '' ? undefined : isActive === 'true',
      format: 'a4' as const,
    };

    try {
      let reason: string | undefined;
      if (reprint) {
        const answer = window.prompt(
          'Motivo de la reimpresión del lote (queda en auditoría):',
          'Reimpresión de credenciales por pérdida',
        );
        if (answer === null) {
          setPrinting(false);
          return;
        }
        reason = answer;
      }

      if (reprint) {
        const blob = await participantsApi.badgeReprint({ ...filters, reason });
        saveBlob(blob, 'credenciales-reimpresas.pdf');
        setNotice('Lote reimpreso y registrado en auditoría.');
      } else {
        const blob = await participantsApi.badgeBatch(filters);
        saveBlob(blob, 'credenciales-asmun.pdf');
        setNotice('PDF de credenciales generado con el filtro actual.');
      }
    } catch (printError) {
      setError(apiErrorMessage(printError, 'No se pudo generar el PDF de credenciales'));
    } finally {
      setPrinting(false);
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
          Su rol ({user.role}) no tiene acceso al módulo de participantes.
        </Alert>
      </div>
    );
  }

  const hasFilters = Boolean(search || schoolId || committeeId || role) || isActive !== 'true';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Encabezado y acciones */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Participantes</h1>
          <p className="text-sm text-gray-600">
            {meta.total} participante(s) · credenciales con QR y código corto único
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canWrite && (
            <>
              <Button type="button" onClick={() => openCreate('full')}>
                <UserPlus className="w-4 h-4" />
                Nuevo participante
              </Button>
              <Button type="button" variant="secondary" onClick={() => openCreate('quick')}>
                <Zap className="w-4 h-4" />
                Registro rápido
              </Button>
              <Button type="button" variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload className="w-4 h-4" />
                Importar Excel
              </Button>
              <Button type="button" variant="secondary" onClick={() => setCatalogsOpen(true)}>
                <Settings2 className="w-4 h-4" />
                Colegios y comités
              </Button>
            </>
          )}
          {canWrite && (
            <>
              <Button
                type="button"
                variant="secondary"
                loading={printing}
                onClick={() => printBatch(false)}
                title="Genera el PDF (4 por hoja A4) con los filtros aplicados"
              >
                <Printer className="w-4 h-4" />
                Credenciales PDF
              </Button>
              <Button
                type="button"
                variant="ghost"
                loading={printing}
                onClick={() => printBatch(true)}
                title="Reimprime el lote y lo registra en auditoría"
              >
                <RotateCcw className="w-4 h-4" />
                Reimprimir lote
              </Button>
            </>
          )}
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

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nombre, apellido, código o documento"
              className="pl-9"
              aria-label="Buscar participantes"
            />
          </div>

          <Select
            value={schoolId}
            onChange={(event) => {
              setSchoolId(event.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por colegio"
          >
            <option value="">Todos los colegios</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </Select>

          <Select
            value={committeeId}
            onChange={(event) => {
              setCommitteeId(event.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por comité"
          >
            <option value="">Todos los comités</option>
            {committees.map((committee) => (
              <option key={committee.id} value={committee.id}>
                {committee.name}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Select
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por rol"
            >
              <option value="">Todos los roles</option>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <Select
              value={isActive}
              onChange={(event) => {
                setIsActive(event.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por estado"
            >
              <option value="true">Activos</option>
              <option value="false">Desactivados</option>
              <option value="">Todos</option>
            </Select>
          </div>
        </div>

        {hasFilters && (
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearchInput('');
                setSearch('');
                setSchoolId('');
                setCommitteeId('');
                setRole('');
                setIsActive('true');
                setPage(1);
              }}
            >
              <RotateCcw className="w-4 h-4" />
              Limpiar filtros
            </Button>
          </div>
        )}
      </Card>

      {/* Tabla */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
            <Spinner className="w-5 h-5" /> Cargando participantes…
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No se encontraron participantes"
            description={
              hasFilters
                ? 'Ajuste los filtros o la búsqueda para ver otros resultados.'
                : 'Registre el primer participante o importe la lista de inscritos desde Excel.'
            }
            action={
              canWrite ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button type="button" onClick={() => openCreate('full')}>
                    <UserPlus className="w-4 h-4" />
                    Nuevo participante
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setImportOpen(true)}>
                    <Upload className="w-4 h-4" />
                    Importar Excel
                  </Button>
                </div>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Código</th>
                  <th className="px-4 py-3 text-left font-medium">Participante</th>
                  <th className="px-4 py-3 text-left font-medium">Rol</th>
                  <th className="px-4 py-3 text-left font-medium">Colegio</th>
                  <th className="px-4 py-3 text-left font-medium">Comité</th>
                  <th className="px-4 py-3 text-center font-medium">Alimentación</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((participant) => (
                  <tr key={participant.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-semibold tracking-wide text-gray-900">
                        {formatShortCode(participant.code)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {participant.lastName}, {participant.firstName}
                      </div>
                      {participant.country && (
                        <div className="text-xs text-gray-500">{participant.country}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={roleBadgeClasses(participant.role)}>
                        {roleLabel(participant.role)}
                      </Badge>
                      {participant.position && (
                        <div className="mt-1 text-xs text-gray-500">{participant.position}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{participant.school?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {participant.committee
                        ? `${participant.committee.name}${participant.committee.shortName ? ` (${participant.committee.shortName})` : ''}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {participant.dietaryNotes ? (
                        <span
                          title={participant.dietaryNotes}
                          className="inline-flex items-center gap-1 text-amber-600"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-xs">Alerta</span>
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {participant.isActive ? (
                        <Badge className="bg-green-50 text-green-700 border-green-200">Activo</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-600 border-gray-300">Inactivo</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canWrite && (
                          <>
                            <IconButton label="Editar participante" onClick={() => openEdit(participant)}>
                              <Pencil className="w-4 h-4" />
                            </IconButton>
                            <IconButton
                              label="Ver credencial"
                              onClick={() => printBadge(participant, false)}
                            >
                              <Printer className="w-4 h-4" />
                            </IconButton>
                            <IconButton
                              label="Reimprimir credencial (queda en auditoría)"
                              onClick={() => printBadge(participant, true)}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </IconButton>
                          </>
                        )}
                        {!canWrite && (
                          <IconButton label="Ver ficha" onClick={() => openEdit(participant)}>
                            <Search className="w-4 h-4" />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50">
            <span className="text-xs text-gray-600">
              Página {meta.page} de {Math.max(meta.totalPages, 1)} · {meta.total} registro(s)
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={meta.page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ParticipantFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        participant={formParticipant}
        variant={formVariant}
        readOnly={!canWrite}
        schools={schools}
        committees={committees}
        onSaved={onSaved}
      />

      <ImportWizardModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          loadParticipants();
          loadCatalogs();
        }}
      />

      <CatalogsModal
        open={catalogsOpen}
        onClose={() => setCatalogsOpen(false)}
        schools={schools}
        committees={committees}
        onChanged={() => {
          loadCatalogs();
          loadParticipants();
        }}
      />
    </div>
  );
}
