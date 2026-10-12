import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';
import {
  SCAN_SOURCE_LABELS,
  checkpointTypeLabel,
  scanResultLabel,
} from '../common/constants/scan.constants';
import { participantRoleLabel } from '../common/constants/participant-role.constants';
import {
  formatDayLabel,
  parseDay,
  parseInstant,
  toDayString,
  toTimeLabel,
} from '../common/utils/datetime.util';
import { buildParticipantSearchFilter } from '../common/utils/participant-search.util';
import {
  ReportParticipantsQueryDto,
  ReportPendingQueryDto,
  ReportScansQueryDto,
} from './dto/reports.dto';

/** Tope defensivo: el evento maneja cientos de filas, no millones. */
const MAX_ROWS = 20000;
const HEADER_FILL = 'FF1D4ED8';
const OK_COLOR = 'FF15803D';
const ERROR_COLOR = 'FFB91C1C';
const MUTED_COLOR = 'FF6B7280';

export interface ReportFile {
  buffer: Buffer;
  filename: string;
  rowCount: number;
}

interface SheetColumn {
  header: string;
  key: string;
  width: number;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
  ) {}

  /** Exportación de participantes con los filtros aplicados (SDD 12.2). */
  async participants(query: ReportParticipantsQueryDto): Promise<ReportFile> {
    const and: Prisma.ParticipantWhereInput[] = [];

    const searchFilter = buildParticipantSearchFilter(query.search);
    if (searchFilter) and.push(searchFilter);

    const schoolId = query.schoolId ?? query.school;
    const committeeId = query.committeeId ?? query.committee;
    if (schoolId) and.push({ schoolId });
    if (committeeId) and.push({ committeeId });
    if (query.role) and.push({ role: query.role });
    if (query.isActive !== undefined && query.isActive !== null) and.push({ isActive: query.isActive });

    const participants = await this.prisma.participant.findMany({
      where: and.length > 0 ? { AND: and } : {},
      select: {
        code: true,
        firstName: true,
        lastName: true,
        role: true,
        position: true,
        documentId: true,
        country: true,
        dietaryNotes: true,
        notes: true,
        isActive: true,
        createdAt: true,
        school: { select: { name: true, city: true } },
        committee: { select: { name: true, shortName: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: MAX_ROWS,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ASMUN Control';
    workbook.created = new Date();

    const sheet = this.createSheet(workbook, 'Participantes', [
      { header: 'Código', key: 'code', width: 12 },
      { header: 'Nombres', key: 'firstName', width: 24 },
      { header: 'Apellidos', key: 'lastName', width: 24 },
      { header: 'Rol', key: 'role', width: 16 },
      { header: 'Cargo', key: 'position', width: 20 },
      { header: 'Colegio / Delegación', key: 'school', width: 32 },
      { header: 'Ciudad', key: 'city', width: 14 },
      { header: 'Comité / Foro', key: 'committee', width: 26 },
      { header: 'Sigla', key: 'committeeShort', width: 10 },
      { header: 'País', key: 'country', width: 16 },
      { header: 'Documento', key: 'documentId', width: 16 },
      { header: 'Restricciones alimentarias', key: 'dietaryNotes', width: 30 },
      { header: 'Observaciones', key: 'notes', width: 28 },
      { header: 'Habilitado', key: 'isActive', width: 12 },
      { header: 'Fecha de registro', key: 'createdDate', width: 16 },
      { header: 'Hora', key: 'createdTime', width: 10 },
    ]);

    participants.forEach((participant) => {
      const row = sheet.addRow({
        code: participant.code,
        firstName: participant.firstName,
        lastName: participant.lastName,
        role: participantRoleLabel(participant.role),
        position: participant.position ?? '',
        school: participant.school?.name ?? '',
        city: participant.school?.city ?? '',
        committee: participant.committee?.name ?? '',
        committeeShort: participant.committee?.shortName ?? '',
        country: participant.country ?? '',
        documentId: participant.documentId ?? '',
        dietaryNotes: participant.dietaryNotes ?? '',
        notes: participant.notes ?? '',
        isActive: participant.isActive ? 'Sí' : 'No',
        createdDate: formatDayLabel(toDayString(participant.createdAt)),
        createdTime: toTimeLabel(participant.createdAt),
      });

      if (participant.dietaryNotes) {
        row.getCell('dietaryNotes').font = { bold: true, color: { argb: ERROR_COLOR } };
      }
      if (!participant.isActive) {
        row.getCell('isActive').font = { color: { argb: MUTED_COLOR }, italic: true };
      }
    });

    return {
      buffer: await this.toBuffer(workbook),
      filename: 'participantes-asmun.xlsx',
      rowCount: participants.length,
    };
  }

  /** Historial cronológico de escaneos, incluidos los intentos rechazados. */
  async scans(query: ReportScansQueryDto): Promise<ReportFile> {
    const and: Prisma.ScanWhereInput[] = [];

    const checkpointId = query.checkpointId ?? query.checkpoint_id;
    if (checkpointId) and.push({ checkpointId });
    if (query.day) and.push({ checkpoint: { day: parseDay(query.day) } });
    if (query.from) and.push({ scannedAt: { gte: parseInstant(`${query.from}T00:00:00`) } });
    if (query.to) and.push({ scannedAt: { lte: parseInstant(`${query.to}T23:59:59.999`) } });
    if (query.result) and.push({ result: query.result });
    if (query.source) and.push({ source: query.source });
    if (query.schoolId) and.push({ participant: { schoolId: query.schoolId } });

    const searchFilter = buildParticipantSearchFilter(query.search);
    if (searchFilter) and.push({ participant: searchFilter });

    const scans = await this.prisma.scan.findMany({
      where: and.length > 0 ? { AND: and } : {},
      select: {
        result: true,
        source: true,
        scannedAt: true,
        note: true,
        voidedReason: true,
        participant: {
          select: {
            code: true,
            firstName: true,
            lastName: true,
            role: true,
            school: { select: { name: true } },
          },
        },
        checkpoint: { select: { name: true, type: true, day: true } },
        user: { select: { fullName: true } },
        voidedByUser: { select: { fullName: true } },
      },
      orderBy: { scannedAt: 'desc' },
      take: MAX_ROWS,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ASMUN Control';
    workbook.created = new Date();

    const sheet = this.createSheet(workbook, 'Escaneos', [
      { header: 'Fecha', key: 'date', width: 14 },
      { header: 'Hora', key: 'time', width: 10 },
      { header: 'Participante', key: 'participant', width: 30 },
      { header: 'Código', key: 'code', width: 12 },
      { header: 'Rol', key: 'role', width: 16 },
      { header: 'Colegio / Delegación', key: 'school', width: 30 },
      { header: 'Punto de control', key: 'checkpoint', width: 26 },
      { header: 'Tipo', key: 'type', width: 14 },
      { header: 'Día del punto', key: 'day', width: 14 },
      { header: 'Resultado', key: 'result', width: 20 },
      { header: 'Origen', key: 'source', width: 20 },
      { header: 'Operador', key: 'user', width: 22 },
      { header: 'Nota', key: 'note', width: 34 },
      { header: 'Anulado por', key: 'voidedBy', width: 22 },
      { header: 'Motivo de anulación', key: 'voidedReason', width: 32 },
    ]);

    scans.forEach((scan) => {
      const row = sheet.addRow({
        date: formatDayLabel(toDayString(scan.scannedAt)),
        time: toTimeLabel(scan.scannedAt),
        participant: scan.participant
          ? `${scan.participant.firstName} ${scan.participant.lastName}`.trim()
          : 'Sin identificar',
        code: scan.participant?.code ?? '',
        role: scan.participant ? participantRoleLabel(scan.participant.role) : '',
        school: scan.participant?.school?.name ?? '',
        checkpoint: scan.checkpoint.name,
        type: checkpointTypeLabel(scan.checkpoint.type),
        day: formatDayLabel(scan.checkpoint.day.toISOString().slice(0, 10)),
        result: scanResultLabel(scan.result),
        source: SCAN_SOURCE_LABELS[scan.source] ?? scan.source,
        user: scan.user.fullName,
        note: scan.note ?? '',
        voidedBy: scan.voidedByUser?.fullName ?? '',
        voidedReason: scan.voidedReason ?? '',
      });

      const resultCell = row.getCell('result');
      if (scan.result === 'ok' || scan.result === 'excepcion') {
        resultCell.font = { bold: true, color: { argb: OK_COLOR } };
      } else if (scan.result === 'anulado') {
        resultCell.font = { italic: true, color: { argb: MUTED_COLOR } };
      } else {
        resultCell.font = { bold: true, color: { argb: ERROR_COLOR } };
      }
    });

    return {
      buffer: await this.toBuffer(workbook),
      filename: 'escaneos-asmun.xlsx',
      rowCount: scans.length,
    };
  }

  /**
   * Pendientes de un punto de control (añadido para catering: quiénes no han
   * recibido su refrigerio o almuerzo). Incluye una hoja con el resumen.
   */
  async pending(query: ReportPendingQueryDto): Promise<ReportFile> {
    const checkpointId = query.checkpointId ?? query.checkpoint_id;

    if (!checkpointId) {
      throw new BadRequestException({
        code: 'CHECKPOINT_REQUIRED',
        message: 'Indique el punto de control (checkpointId) para exportar los pendientes.',
      });
    }

    const [{ checkpoint, participants }, summary] = await Promise.all([
      this.dashboard.pendingList({ checkpointId, schoolId: query.schoolId, role: query.role }),
      this.dashboard.summary({ checkpointId }),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ASMUN Control';
    workbook.created = new Date();

    const sheet = this.createSheet(workbook, 'Pendientes', [
      { header: 'Código', key: 'code', width: 12 },
      { header: 'Apellidos', key: 'lastName', width: 24 },
      { header: 'Nombres', key: 'firstName', width: 24 },
      { header: 'Rol', key: 'role', width: 16 },
      { header: 'Colegio / Delegación', key: 'school', width: 32 },
      { header: 'Comité / Foro', key: 'committee', width: 26 },
      { header: 'País', key: 'country', width: 16 },
      { header: 'Restricciones alimentarias', key: 'dietaryNotes', width: 30 },
    ]);

    participants.forEach((participant) => {
      const row = sheet.addRow({
        code: participant.code,
        lastName: participant.lastName,
        firstName: participant.firstName,
        role: participant.roleLabel,
        school: participant.school ?? '',
        committee: participant.committee ?? '',
        country: participant.country ?? '',
        dietaryNotes: participant.dietaryNotes ?? '',
      });

      if (participant.dietaryNotes) {
        row.getCell('dietaryNotes').font = { bold: true, color: { argb: ERROR_COLOR } };
      }
    });

    const progress = summary.checkpoints[0];
    const summarySheet = workbook.addWorksheet('Resumen');
    summarySheet.columns = [
      { header: 'Dato', key: 'label', width: 34 },
      { header: 'Valor', key: 'value', width: 22 },
    ];
    const headerRow = summarySheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };

    summarySheet.addRow({ label: 'Punto de control', value: checkpoint.name });
    summarySheet.addRow({ label: 'Tipo', value: checkpointTypeLabel(checkpoint.type) });
    summarySheet.addRow({ label: 'Día del evento', value: formatDayLabel(toDayString(checkpoint.day)) });
    summarySheet.addRow({ label: 'Esperados', value: progress?.expected ?? 0 });
    summarySheet.addRow({ label: 'Registrados', value: progress?.registered ?? 0 });
    summarySheet.addRow({ label: 'Pendientes', value: progress?.pending ?? participants.length });
    summarySheet.addRow({ label: 'Avance', value: `${progress?.percentage ?? 0}%` });
    summarySheet.addRow({ label: 'Exportado', value: `${formatDayLabel(toDayString(new Date()))} ${toTimeLabel(new Date())}` });

    const slug = checkpoint.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return {
      buffer: await this.toBuffer(workbook),
      filename: `pendientes-${slug || 'punto'}.xlsx`,
      rowCount: participants.length,
    };
  }

  private createSheet(
    workbook: ExcelJS.Workbook,
    name: string,
    columns: SheetColumn[],
  ): ExcelJS.Worksheet {
    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = columns;

    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    header.alignment = { vertical: 'middle' };
    header.height = 20;

    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };

    return sheet;
  }

  private async toBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
