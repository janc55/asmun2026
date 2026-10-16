import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ParticipantRole } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { extname } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { ParticipantsService } from '../participants.service';
import { isValidShortCode } from '../../common/utils/code-generator.util';
import { SchoolsService } from '../../schools/schools.service';
import { CommitteesService } from '../../committees/committees.service';
import { ImportParticipantsDto } from './dto/import-participants.dto';
import {
  ACCEPTED_ROLE_VALUES,
  IMPORT_FIELD_ALIASES,
  IMPORT_FIELD_LABELS,
  ImportField,
  detectHeaderRow,
  mapHeaders,
  normalizeHeader,
  normalizePersonKey,
  parseParticipantRole,
  splitFullName,
} from './header-mapping.util';

/** Límites defensivos: el evento maneja ~200 participantes por lista. */
const MAX_IMPORT_ROWS = 2000;
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = ['.xlsx', '.csv'];

export interface ImportRowResult {
  /** Número de fila tal como se ve en Excel. */
  row: number;
  status: 'ok' | 'error';
  errors: string[];
  warnings: string[];
  participantId?: number;
  code?: string;
  data: {
    firstName: string;
    lastName: string;
    role: ParticipantRole | null;
    school: string | null;
    committee: string | null;
    country: string | null;
    position: string | null;
    documentId: string | null;
    dietaryNotes: string | null;
    notes: string | null;
  };
}

export interface ImportReport {
  mode: 'preview' | 'confirmed';
  fileName: string;
  sheetName: string;
  /** Fila de encabezado detectada (1-based). */
  headerRow: number;
  detectedColumns: Array<{ field: ImportField; label: string; header: string }>;
  unknownColumns: string[];
  duplicatedColumns: Array<{ field: ImportField; header: string }>;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    created: number;
    failed: number;
    schoolsToCreate: string[];
    committeesToCreate: string[];
    possibleDuplicates: number;
    appliedDefaultRole: ParticipantRole | null;
    appliedDefaultSchool: string | null;
  };
  rows: ImportRowResult[];
}

interface SheetRow {
  number: number;
  cells: unknown[];
}

@Injectable()
export class ParticipantsImportService {
  private readonly logger = new Logger(ParticipantsImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly participants: ParticipantsService,
    private readonly schools: SchoolsService,
    private readonly committees: CommitteesService,
  ) {}

  /**
   * Plantilla descargable (RF-02): encabezados esperados, filas de ejemplo y una
   * hoja de instrucciones con las variantes aceptadas.
   */
  async buildTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ASMUN Control';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Participantes', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
      { header: 'Nombres', key: 'firstName', width: 24 },
      { header: 'Apellidos', key: 'lastName', width: 24 },
      { header: 'Rol', key: 'role', width: 14 },
      { header: 'Colegio', key: 'school', width: 32 },
      { header: 'Ciudad', key: 'city', width: 16 },
      { header: 'Comité', key: 'committee', width: 26 },
      { header: 'Sigla', key: 'committeeShort', width: 10 },
      { header: 'País', key: 'country', width: 16 },
      { header: 'Cargo', key: 'position', width: 20 },
      { header: 'Documento', key: 'documentId', width: 16 },
      { header: 'Restricciones alimentarias', key: 'dietaryNotes', width: 30 },
      { header: 'Observaciones', key: 'notes', width: 28 },
      { header: 'Código', key: 'code', width: 12 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 22;

    sheet.addRow({
      firstName: 'Ana María',
      lastName: 'Quispe Mamani',
      role: 'delegado',
      school: 'Colegio Americano de Oruro',
      city: 'Oruro',
      committee: 'Consejo de Seguridad',
      committeeShort: 'CS',
      country: 'Brasil',
      position: '',
      documentId: '',
      dietaryNotes: 'Sin gluten',
      notes: '',
      code: '',
    });
    sheet.addRow({
      firstName: 'Luis',
      lastName: 'Fernández Rojas',
      role: 'docente',
      school: 'Colegio San Ignacio',
      city: 'La Paz',
      committee: 'Asamblea General',
      committeeShort: 'AG',
      country: 'Francia',
      position: 'Docente asesor',
      documentId: '',
      dietaryNotes: '',
      notes: '',
      code: '',
    });

    // Lista desplegable de roles para reducir errores de digitación.
    const roleList = Object.values(ParticipantRole).join(',');
    for (let row = 2; row <= 300; row += 1) {
      sheet.getCell(row, 3).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${roleList}"`],
      };
    }

    const help = workbook.addWorksheet('Instrucciones');
    help.columns = [
      { header: 'Columna', key: 'column', width: 30 },
      { header: 'Obligatoria', key: 'required', width: 12 },
      { header: 'Encabezados aceptados', key: 'aliases', width: 70 },
    ];
    help.getRow(1).font = { bold: true };
    help.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };

    (Object.keys(IMPORT_FIELD_LABELS) as ImportField[]).forEach((field) => {
      help.addRow({
        column: IMPORT_FIELD_LABELS[field],
        required: field === 'firstName' || field === 'lastName' ? 'Sí' : 'No',
        aliases: IMPORT_FIELD_ALIASES[field].join(', '),
      });
    });

    help.addRow({});
    help.addRow({ column: 'Roles válidos', aliases: ACCEPTED_ROLE_VALUES });
    help.addRow({
      column: 'Nombre completo',
      aliases:
        'Si la lista trae una sola columna con el nombre completo, se acepta como encabezado "Nombre completo", "Estudiante" o "Alumno" y el sistema separa apellidos y nombres.',
    });
    help.addRow({
      column: 'Colegios y comités',
      aliases:
        'Los colegios y comités que no existan se crean automáticamente al confirmar la importación (se puede desactivar).',
    });
    help.addRow({
      column: 'Código',
      aliases:
        'No es necesario completarlo: al crear el participante el sistema asigna un código corto único de 6 caracteres.',
    });
    help.addRow({
      column: 'Filas vacías',
      aliases: 'Las filas sin datos se ignoran. Las filas con errores se informan y no se guardan.',
    });
    help.addRow({
      column: 'Columnas opcionales vacías',
      aliases:
        'Solo Nombres y Apellidos son obligatorios. Puede dejar en blanco las columnas que no tenga (Rol, Colegio, Ciudad, Sigla…): las filas se importan igual y el rol vacío toma el valor del campo "Rol por defecto" del asistente.',
    });
    help.addRow({
      column: 'Varias hojas',
      aliases:
        'Puede subir el archivo con esta hoja de Instrucciones: el sistema analiza la hoja que contiene la tabla de participantes y omite las de instrucciones o leyendas.',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /** Vista previa o importación confirmada (RF-02). */
  async import(file: { buffer: Buffer; originalname: string; size: number }, options: ImportParticipantsDto): Promise<ImportReport> {
    const fileName = file?.originalname ?? 'listado.xlsx';
    const extension = extname(fileName).toLowerCase();

    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Debe adjuntar el archivo de Excel o CSV en el campo "file".',
      });
    }

    if (file.size && file.size > MAX_FILE_SIZE) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `El archivo supera el máximo permitido de ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB.`,
      });
    }

    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_FORMAT',
        message:
          extension === '.xls'
            ? 'El formato .xls (Excel 97-2003) no es compatible. Guarde el archivo como .xlsx o .csv e intente de nuevo.'
            : `Formato '${extension || 'desconocido'}' no compatible. Use un archivo .xlsx o .csv.`,
      });
    }

    const { sheetName, rows } = await this.readSheet(file.buffer, extension);

    if (rows.length === 0) {
      throw new BadRequestException({
        code: 'EMPTY_FILE',
        message: 'El archivo no contiene filas con datos.',
      });
    }

    if (rows.length > MAX_IMPORT_ROWS + 10) {
      throw new BadRequestException({
        code: 'TOO_MANY_ROWS',
        message: `El archivo tiene ${rows.length} filas y el máximo soportado es ${MAX_IMPORT_ROWS}.`,
      });
    }

    const headerIndex = detectHeaderRow(rows.map((row) => row.cells));
    const headerOffset = rows[headerIndex]?.number ?? 1;
    const mapping = mapHeaders(rows[headerIndex]?.cells ?? []);

    if (mapping.missingRequired.length > 0) {
      const missing = mapping.missingRequired
        .map((field) => `${IMPORT_FIELD_LABELS[field]} (${IMPORT_FIELD_ALIASES[field].slice(0, 4).join(', ')}…)`)
        .join(' | ');
      throw new BadRequestException({
        code: 'MISSING_COLUMNS',
        message: `No se reconocieron las columnas obligatorias: ${missing}. Descargue la plantilla para ver los encabezados aceptados.`,
      });
    }

    const confirm = options.confirm === true;
    const createMissingCatalogs = options.createMissingCatalogs !== false;
    const defaultRole = options.defaultRole ?? ParticipantRole.delegado;
    const defaultSchoolName = options.defaultSchoolName?.trim() || null;

    const { schoolCache, committeeCache } = await this.loadCatalogCaches();
    const existingKeys = await this.loadExistingPersonKeys();

    const schoolsToCreate = new Set<string>();
    const committeesToCreate = new Set<string>();
    const seenInFile = new Map<string, number>();
    const results: ImportRowResult[] = [];
    let created = 0;
    let possibleDuplicates = 0;
    /** Se activa cuando el rol por defecto se aplicó al menos una vez. */
    let usedDefaultRole = false;
    /** Se activa cuando el colegio por defecto se aplicó al menos una vez. */
    let usedDefaultSchool = false;

    const roleColumnPresent = mapping.columns.role !== undefined;
    const schoolColumnPresent = mapping.columns.school !== undefined;

    const valueAt = (row: SheetRow, field: ImportField): string => {
      const index = mapping.columns[field];
      if (index === undefined) return '';
      return cellToString(row.cells[index]);
    };

    for (let i = headerIndex + 1; i < rows.length; i += 1) {
      const sheetRow = rows[i];
      const errors: string[] = [];
      const warnings: string[] = [];

      let firstName = valueAt(sheetRow, 'firstName');
      let lastName = valueAt(sheetRow, 'lastName');

      // Columna única de nombre completo: se usa solo si falta alguna de las dos.
      if ((!firstName || !lastName) && mapping.columns.fullName !== undefined) {
        const fullName = valueAt(sheetRow, 'fullName');
        if (fullName) {
          const split = splitFullName(fullName);
          firstName = firstName || split.firstName;
          lastName = lastName || split.lastName;
        }
      }

      const rawRole = valueAt(sheetRow, 'role');
      const schoolFromFile = valueAt(sheetRow, 'school');
      const rawSchool = schoolFromFile || defaultSchoolName || '';
      const rawCommittee = valueAt(sheetRow, 'committee');
      const country = valueAt(sheetRow, 'country');
      const position = valueAt(sheetRow, 'position');
      const documentId = valueAt(sheetRow, 'documentId');
      const dietaryNotes = valueAt(sheetRow, 'dietaryNotes');
      const notes = valueAt(sheetRow, 'notes');
      const rawCode = valueAt(sheetRow, 'code');

      const isBlankRow =
        !firstName && !lastName && !rawRole && !rawSchool && !rawCommittee && !country && !rawCode;
      if (isBlankRow) continue;

      if (!schoolFromFile && defaultSchoolName) usedDefaultSchool = true;

      if (!firstName) errors.push('Falta el nombre.');
      if (!lastName) errors.push('Falta el apellido.');

      let role: ParticipantRole | null = null;
      if (roleColumnPresent) {
        if (!rawRole) {
          // La columna existe pero está vacía en esta fila: las listas suelen
          // traer "Rol" en blanco. Se aplica el rol por defecto en lugar de
          // rechazar la fila.
          role = defaultRole;
          usedDefaultRole = true;
          warnings.push(`Sin rol indicado: se aplicó '${defaultRole}'.`);
        } else {
          role = parseParticipantRole(rawRole);
          if (!role) {
            errors.push(`Rol '${rawRole}' no reconocido. Valores válidos: ${ACCEPTED_ROLE_VALUES}.`);
          }
        }
      } else {
        role = defaultRole;
        usedDefaultRole = true;
      }

      let schoolId: number | null = null;
      if (rawSchool) {
        const key = normalizeHeader(rawSchool);
        if (schoolCache.has(key)) {
          schoolId = schoolCache.get(key)!;
        } else if (createMissingCatalogs) {
          schoolsToCreate.add(rawSchool.trim());
          if (confirm) {
            const { id } = await this.schools.ensureByName(rawSchool.trim(), valueAt(sheetRow, 'schoolCity') || null);
            schoolCache.set(key, id);
            schoolId = id;
          }
        } else {
          errors.push(`El colegio '${rawSchool}' no existe y la creación automática está desactivada.`);
        }
      } else if (schoolColumnPresent || defaultSchoolName) {
        warnings.push('Sin colegio asignado.');
      }

      let committeeId: number | null = null;
      if (rawCommittee) {
        const key = normalizeHeader(rawCommittee);
        if (committeeCache.has(key)) {
          committeeId = committeeCache.get(key)!;
        } else if (createMissingCatalogs) {
          committeesToCreate.add(rawCommittee.trim());
          if (confirm) {
            const { id } = await this.committees.ensureByName(
              rawCommittee.trim(),
              valueAt(sheetRow, 'committeeShort') || null,
            );
            committeeCache.set(key, id);
            committeeId = id;
          }
        } else {
          errors.push(`El comité '${rawCommittee}' no existe y la creación automática está desactivada.`);
        }
      }

      if (rawCode && !isValidShortCode(rawCode)) {
        errors.push(`El código '${rawCode}' no es válido (6 caracteres, sin 0, O, 1, I, L, U).`);
      }

      // Duplicados: primero dentro del archivo, luego contra lo ya registrado.
      if (firstName && lastName) {
        const personKey = normalizePersonKey(firstName, lastName);
        const previousRow = seenInFile.get(personKey);
        if (previousRow !== undefined) {
          warnings.push(`Posible duplicado: ya aparece en la fila ${previousRow}.`);
          possibleDuplicates += 1;
        } else {
          seenInFile.set(personKey, sheetRow.number);
        }

        if (existingKeys.has(personKey)) {
          warnings.push('Ya existe un participante con el mismo nombre y apellido en el sistema.');
          possibleDuplicates += 1;
        }
      }

      const rowResult: ImportRowResult = {
        row: sheetRow.number,
        status: errors.length > 0 ? 'error' : 'ok',
        errors,
        warnings,
        data: {
          firstName: firstName || '',
          lastName: lastName || '',
          role,
          school: rawSchool || null,
          committee: rawCommittee || null,
          country: country || null,
          position: position || null,
          documentId: documentId || null,
          dietaryNotes: dietaryNotes || null,
          notes: notes || null,
        },
      };

      if (confirm && rowResult.status === 'ok') {
        try {
          const participant = await this.participants.create({
            firstName,
            lastName,
            role: role as ParticipantRole,
            schoolId,
            committeeId,
            country: country || undefined,
            position: position || undefined,
            documentId: documentId || undefined,
            dietaryNotes: dietaryNotes || undefined,
            notes: notes || undefined,
            code: rawCode || undefined,
          });
          rowResult.participantId = participant.id;
          rowResult.code = participant.code;
          created += 1;
        } catch (error: any) {
          const message =
            typeof error?.response?.message === 'string'
              ? error.response.message
              : error?.message || 'Error desconocido al guardar la fila.';
          rowResult.status = 'error';
          rowResult.errors = [...errors, message];
        }
      }

      results.push(rowResult);
    }

    const validRows = results.filter((row) => row.status === 'ok').length;
    const invalidRows = results.length - validRows;

    this.logger.log(
      `Importación ${confirm ? 'confirmada' : 'en vista previa'} de '${fileName}': ${results.length} filas, ${validRows} válidas, ${invalidRows} con error, ${created} creadas.`,
    );

    return {
      mode: confirm ? 'confirmed' : 'preview',
      fileName,
      sheetName,
      headerRow: headerOffset,
      detectedColumns: mapping.detected.map((item) => ({
        field: item.field,
        label: IMPORT_FIELD_LABELS[item.field],
        header: item.header,
      })),
      unknownColumns: mapping.unknown.map((item) => item.header),
      duplicatedColumns: mapping.duplicated.map((item) => ({
        field: item.field,
        header: item.header,
      })),
      summary: {
        totalRows: results.length,
        validRows,
        invalidRows,
        created,
        failed: invalidRows,
        schoolsToCreate: Array.from(schoolsToCreate),
        committeesToCreate: Array.from(committeesToCreate),
        possibleDuplicates,
        appliedDefaultRole: usedDefaultRole ? defaultRole : null,
        appliedDefaultSchool: usedDefaultSchool ? defaultSchoolName : null,
      },
      rows: results,
    };
  }

  private async readSheet(
    buffer: Buffer,
    extension: string,
  ): Promise<{ sheetName: string; rows: SheetRow[] }> {
    const workbook = new ExcelJS.Workbook();

    try {
      if (extension === '.csv') {
        // El CSV se lee con el mismo motor para no depender de un parser aparte.
        await workbook.csv.read(Readable.from([buffer]) as any);
      } else {
        await workbook.xlsx.load(buffer as any);
      }
    } catch (error: any) {
      throw new BadRequestException({
        code: 'UNREADABLE_FILE',
        message: `No se pudo leer el archivo: ${error?.message ?? 'formato no reconocido'}. Verifique que sea un Excel o CSV válido.`,
      });
    }

    const worksheet = this.pickWorksheet(workbook);
    if (!worksheet) {
      throw new BadRequestException({
        code: 'EMPTY_FILE',
        message: 'El archivo no contiene ninguna hoja con datos.',
      });
    }

    return { sheetName: worksheet.name, rows: this.extractRows(worksheet) };
  }

  /** Convierte una hoja en filas de celdas; `maxRows` limita las primeras filas. */
  private extractRows(worksheet: ExcelJS.Worksheet, maxRows?: number): SheetRow[] {
    const columnCount = Math.max(worksheet.columnCount || 0, 1);
    const rows: SheetRow[] = [];

    worksheet.eachRow({ includeEmpty: false }, (row) => {
      if (maxRows !== undefined && rows.length >= maxRows) return;
      const cells: unknown[] = [];
      for (let column = 1; column <= columnCount; column += 1) {
        cells.push(row.getCell(column).value);
      }
      rows.push({ number: row.number, cells });
    });

    return rows;
  }

  /**
   * Elige la hoja que contiene la tabla de participantes. La plantilla y buena
   * parte de los listados reales traen una segunda hoja de "Instrucciones" (o de
   * leyenda); analizar esa hoja producía el error MISSING_COLUMNS aunque los datos
   * estuvieran correctos en la otra. Se puntúa cada hoja por los encabezados que
   * reconoce y se prefiere la de mayor puntaje.
   */
  private pickWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
    if (workbook.worksheets.length === 0) return undefined;
    if (workbook.worksheets.length === 1) return workbook.worksheets[0];

    const HELP_SHEET = /instruc|ayuda|help|readme|leyenda|diccionario|ejemplo|catalog/i;
    const DATA_SHEET = /participant|inscrit|lista|registro|datos|delegad/i;

    let best = workbook.worksheets[0];
    let bestScore = -Infinity;

    workbook.worksheets.forEach((worksheet) => {
      const head = this.extractRows(worksheet, 10).map((row) => row.cells);
      const headerIndex = detectHeaderRow(head);
      const mapping = mapHeaders(head[headerIndex] ?? []);

      let score = mapping.detected.length;
      if (mapping.columns.firstName !== undefined && mapping.columns.lastName !== undefined) {
        score += 10;
      }
      if (DATA_SHEET.test(worksheet.name)) score += 2;
      if (HELP_SHEET.test(worksheet.name)) score -= 20;

      if (score > bestScore) {
        bestScore = score;
        best = worksheet;
      }
    });

    return best;
  }

  private async loadCatalogCaches() {
    const [schools, committees] = await Promise.all([
      this.prisma.school.findMany({ select: { id: true, name: true } }),
      this.prisma.committee.findMany({ select: { id: true, name: true, shortName: true } }),
    ]);

    const schoolCache = new Map<string, number>();
    schools.forEach((school) => schoolCache.set(normalizeHeader(school.name), school.id));

    const committeeCache = new Map<string, number>();
    committees.forEach((committee) => {
      committeeCache.set(normalizeHeader(committee.name), committee.id);
      if (committee.shortName) committeeCache.set(normalizeHeader(committee.shortName), committee.id);
    });

    return { schoolCache, committeeCache };
  }

  private async loadExistingPersonKeys(): Promise<Set<string>> {
    const participants = await this.prisma.participant.findMany({
      select: { firstName: true, lastName: true },
    });
    return new Set(participants.map((p) => normalizePersonKey(p.firstName, p.lastName)));
  }
}

/** ExcelJS entrega celdas como texto, número, fecha, fórmula o texto enriquecido. */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  const candidate = value as any;
  if (Array.isArray(candidate.richText)) {
    return candidate.richText.map((part: any) => part?.text ?? '').join('').trim();
  }
  if (candidate.result !== undefined && candidate.result !== null) return String(candidate.result).trim();
  if (typeof candidate.text === 'string') return candidate.text.trim();
  if (candidate.formula !== undefined) return '';
  return String(value).trim();
}
