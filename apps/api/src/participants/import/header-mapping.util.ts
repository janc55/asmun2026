import { ParticipantRole } from '@prisma/client';

/**
 * Importación masiva tolerante a variaciones de encabezado (RF-02).
 *
 * Las listas de los colegios llegan con nombres de columna distintos
 * ("Nombre/Nombres", "Colegio/Delegación", "Restricciones alimentarias"…), por
 * eso la detección se hace sobre el encabezado normalizado: minúsculas, sin
 * tildes y sin signos.
 */

export type ImportField =
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'role'
  | 'position'
  | 'school'
  | 'schoolCity'
  | 'committee'
  | 'committeeShort'
  | 'country'
  | 'documentId'
  | 'dietaryNotes'
  | 'notes'
  | 'code';

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  firstName: 'Nombres',
  lastName: 'Apellidos',
  fullName: 'Nombre completo',
  role: 'Rol',
  position: 'Cargo',
  school: 'Colegio / Delegación',
  schoolCity: 'Ciudad',
  committee: 'Comité / Foro',
  committeeShort: 'Sigla del comité',
  country: 'País',
  documentId: 'Documento',
  dietaryNotes: 'Restricciones alimentarias',
  notes: 'Observaciones',
  code: 'Código corto',
};

export const IMPORT_FIELD_ALIASES: Record<ImportField, string[]> = {
  firstName: [
    'nombre',
    'nombres',
    'primernombre',
    'nombre1',
    'nombredelparticipante',
    'nombresdelparticipante',
    'participante',
  ],
  lastName: [
    'apellido',
    'apellidos',
    'primerapellido',
    'apellido1',
    'apellidopaterno',
    'apellidosdelparticipante',
  ],
  fullName: [
    'nombrecompleto',
    'nombresyapellidos',
    'apellidosynombres',
    'nombreyapellido',
    'nombresapellidos',
    'estudiante',
    'alumno',
  ],
  role: ['rol', 'tipodeparticipante', 'tipoparticipante', 'categoria', 'tipoparticipacion', 'calidad'],
  position: ['cargo', 'posicion', 'funcion', 'cargooposicion', 'responsabilidad'],
  school: [
    'colegio',
    'delegacion',
    'institucion',
    'unidadeducativa',
    'colegioounidadeducativa',
    'colegiodelegacion',
    'establecimiento',
    'colegioinstitucion',
  ],
  schoolCity: ['ciudad', 'ciudaddelcolegio', 'localidad', 'procedencia'],
  committee: ['comite', 'foro', 'comision', 'comiteforo', 'comisionforo', 'organo', 'organoounidad'],
  committeeShort: ['sigla', 'siglas', 'abreviatura', 'siglacomit'],
  country: ['pais', 'paisasignado', 'paisrepresentado', 'representacion', 'paisdelegacion'],
  documentId: [
    'documento',
    'documentodeidentidad',
    'ceduladeidentidad',
    'cedula',
    'ci',
    'cinit',
    'nrodocumento',
    'numerodocumento',
    'di',
  ],
  dietaryNotes: [
    'restricciones',
    'restriccionesalimentarias',
    'alergias',
    'alergiasorestricciones',
    'dieta',
    'alimentacion',
    'observacionesalimentarias',
    'requerimientoalimentario',
  ],
  notes: ['observaciones', 'observacion', 'notas', 'comentarios', 'detalle'],
  code: ['codigo', 'codigocorto', 'codigoalfanumerico', 'codigoparticipante'],
};

/** Campos sin los cuales no se puede crear un participante. */
export const IMPORT_REQUIRED_FIELDS: ImportField[] = ['firstName', 'lastName'];

const ROLE_ALIASES: Record<string, ParticipantRole> = {
  delegado: ParticipantRole.delegado,
  delegada: ParticipantRole.delegado,
  delegate: ParticipantRole.delegado,
  delegados: ParticipantRole.delegado,
  docente: ParticipantRole.docente,
  docentes: ParticipantRole.docente,
  asesor: ParticipantRole.docente,
  asesora: ParticipantRole.docente,
  docenteasesor: ParticipantRole.docente,
  profesor: ParticipantRole.docente,
  profesora: ParticipantRole.docente,
  teacher: ParticipantRole.docente,
  faculty: ParticipantRole.docente,
  mesa: ParticipantRole.mesa,
  mesadirectiva: ParticipantRole.mesa,
  mesas: ParticipantRole.mesa,
  presidente: ParticipantRole.mesa,
  presidenta: ParticipantRole.mesa,
  presidencia: ParticipantRole.mesa,
  secretaria: ParticipantRole.secretaria,
  secretario: ParticipantRole.secretaria,
  secretariageneral: ParticipantRole.secretaria,
  secretarias: ParticipantRole.secretaria,
  staff: ParticipantRole.staff,
  logistica: ParticipantRole.staff,
  organizacion: ParticipantRole.staff,
  organizador: ParticipantRole.staff,
  voluntario: ParticipantRole.staff,
  voluntaria: ParticipantRole.staff,
  invitado: ParticipantRole.invitado,
  invitada: ParticipantRole.invitado,
  invitados: ParticipantRole.invitado,
  visitante: ParticipantRole.invitado,
  guest: ParticipantRole.invitado,
};

/** Minúsculas, sin tildes y sin signos: `"N° Documento"` → `"ndocumento"`. */
export function normalizeHeader(value: unknown): string {
  const text = headerText(value);
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Texto plano de una celda de encabezado. ExcelJS entrega las celdas como texto,
 * número, fecha, fórmula o **texto enriquecido** (`{ richText: [...] }`); sin esta
 * conversión, un encabezado con negrita parcial se leería como `[object Object]`
 * y la columna se perdería.
 */
export function headerText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  const candidate = value as any;
  if (Array.isArray(candidate.richText)) {
    return candidate.richText.map((part: any) => part?.text ?? '').join('').trim();
  }
  if (candidate.result !== undefined && candidate.result !== null) {
    return String(candidate.result).trim();
  }
  if (typeof candidate.text === 'string') return candidate.text.trim();
  if (candidate.formula !== undefined) return '';
  return '';
}

/** Normaliza un nombre de persona para comparar duplicados. */
export function normalizePersonKey(firstName: string, lastName: string): string {
  return `${normalizeHeader(lastName)}|${normalizeHeader(firstName)}`;
}

export interface HeaderMapping {
  /** Índice de columna (0-based) por campo detectado. */
  columns: Partial<Record<ImportField, number>>;
  /** Encabezados tal como aparecen en el archivo, para mostrarlos en la vista previa. */
  headers: string[];
  detected: Array<{ field: ImportField; header: string; index: number }>;
  unknown: Array<{ header: string; index: number }>;
  duplicated: Array<{ field: ImportField; header: string; index: number }>;
  missingRequired: ImportField[];
}

const FIELD_BY_ALIAS: Map<string, ImportField> = (() => {
  const map = new Map<string, ImportField>();
  (Object.keys(IMPORT_FIELD_ALIASES) as ImportField[]).forEach((field) => {
    IMPORT_FIELD_ALIASES[field].forEach((alias) => {
      if (!map.has(alias)) map.set(alias, field);
    });
  });
  return map;
})();

export function mapHeaders(headerCells: unknown[]): HeaderMapping {
  const headers = headerCells.map((cell) => headerText(cell));
  const columns: Partial<Record<ImportField, number>> = {};
  const detected: HeaderMapping['detected'] = [];
  const unknown: HeaderMapping['unknown'] = [];
  const duplicated: HeaderMapping['duplicated'] = [];

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (!normalized) return;

    const field = FIELD_BY_ALIAS.get(normalized);
    if (!field) {
      unknown.push({ header, index });
      return;
    }

    if (columns[field] !== undefined) {
      // Ya hay una columna para ese campo: se conserva la primera.
      duplicated.push({ field, header, index });
      return;
    }

    columns[field] = index;
    detected.push({ field, header, index });
  });

  const missingRequired = IMPORT_REQUIRED_FIELDS.filter((field) => columns[field] === undefined);

  // Si no hay columnas separadas pero sí un "nombre completo", la fila se parte.
  if (missingRequired.length > 0 && columns.fullName !== undefined) {
    return {
      columns,
      headers,
      detected,
      unknown,
      duplicated,
      missingRequired: missingRequired.filter((field) => field !== 'firstName' && field !== 'lastName'),
    };
  }

  return { columns, headers, detected, unknown, duplicated, missingRequired };
}

/**
 * Elige la fila de encabezado: las listas suelen traer títulos o logos en las
 * primeras filas, así que se busca la fila con más columnas reconocidas.
 */
export function detectHeaderRow(rows: unknown[][], maxScan = 10): number {
  let bestIndex = 0;
  let bestScore = -1;

  rows.slice(0, maxScan).forEach((row, index) => {
    if (!Array.isArray(row)) return;
    const score = row.reduce<number>((acc, cell) => {
      const normalized = normalizeHeader(cell);
      return acc + (normalized && FIELD_BY_ALIAS.has(normalized) ? 1 : 0);
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestScore >= 2 ? bestIndex : 0;
}

export function parseParticipantRole(value: unknown): ParticipantRole | null {
  const normalized = normalizeHeader(value);
  if (!normalized) return null;
  return ROLE_ALIASES[normalized] ?? null;
}

export const ACCEPTED_ROLE_VALUES = Object.values(ParticipantRole).join(', ');

/** Parte "Quispe Mamani Ana María" en nombres y apellidos de forma razonable. */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const clean = String(fullName).trim().replace(/\s+/g, ' ');
  const parts = clean.split(' ').filter(Boolean);

  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };

  // Convención de las listas escolares: primero apellidos, luego nombres. Con 4
  // palabras (dos apellidos + dos nombres) se reparte en mitades.
  if (parts.length === 2) return { firstName: parts[1], lastName: parts[0] };
  const half = Math.floor(parts.length / 2);
  return {
    firstName: parts.slice(half).join(' '),
    lastName: parts.slice(0, half).join(' '),
  };
}
