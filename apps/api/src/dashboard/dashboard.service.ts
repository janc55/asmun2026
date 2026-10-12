import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CheckpointType, ParticipantRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginatedResult, resolvePagination } from '../common/dto/pagination.dto';
import {
  CHECKPOINT_TYPE_LABELS,
  REJECTED_SCAN_RESULTS,
  VALID_SCAN_RESULTS,
  scanResultLabel,
} from '../common/constants/scan.constants';
import { participantRoleLabel } from '../common/constants/participant-role.constants';
import {
  formatDayLabel,
  parseDay,
  toDayString,
  toTimeLabel,
  toZonedIso,
} from '../common/utils/datetime.util';
import { buildParticipantSearchFilter } from '../common/utils/participant-search.util';
import { CHECKPOINT_SELECT, CheckpointRow, toCheckpointView } from '../checkpoints/checkpoints.service';
import { describeCheckpointStatus, evaluateCheckpointWindow } from '../checkpoints/checkpoint-window.util';
import { QueryDashboardDto, QueryPendingDto } from './dto/dashboard.dto';

export interface CheckpointProgress {
  id: number;
  name: string;
  type: CheckpointType;
  typeLabel: string;
  day: string;
  dayLabel: string;
  windowLabel: string;
  status: ReturnType<typeof describeCheckpointStatus>;
  expected: number;
  registered: number;
  pending: number;
  percentage: number;
  exceptions: number;
  voided: number;
  rejected: number;
  duplicates: number;
  lastScanAt: string | null;
  lastScanAtLabel: string | null;
  byRole: Array<{ role: string; label: string; expected: number; registered: number }>;
  bySchool: Array<{ schoolId: number | null; school: string; expected: number; registered: number; pending: number }>;
}

export interface SchoolProgress {
  schoolId: number | null;
  school: string;
  expected: number;
  registered: number;
  pending: number;
  percentage: number;
}

export interface DashboardSummary {
  generatedAt: string;
  generatedAtLabel: string;
  event: { name: string; timezone: string; today: string; days: string[] };
  totals: {
    activeParticipants: number;
    attendedParticipants: number;
    attendancePercentage: number;
    checkpoints: number;
    openCheckpoints: number;
    validScans: number;
    exceptions: number;
    rejectedScans: number;
    voidedScans: number;
    byResult: Array<{ result: string; label: string; count: number }>;
  };
  checkpoints: CheckpointProgress[];
  byType: Array<{
    type: string;
    label: string;
    expected: number;
    registered: number;
    pending: number;
    percentage: number;
  }>;
  bySchool: SchoolProgress[];
}

export interface PendingParticipant {
  id: number;
  code: string;
  name: string;
  firstName: string;
  lastName: string;
  role: string;
  roleLabel: string;
  position: string | null;
  country: string | null;
  school: string | null;
  committee: string | null;
  committeeShort: string | null;
  dietaryNotes: string | null;
}

const PENDING_SELECT = {
  id: true,
  code: true,
  firstName: true,
  lastName: true,
  role: true,
  position: true,
  country: true,
  dietaryNotes: true,
  school: { select: { id: true, name: true } },
  committee: { select: { id: true, name: true, shortName: true } },
} satisfies Prisma.ParticipantSelect;

type PendingRow = Prisma.ParticipantGetPayload<{ select: typeof PENDING_SELECT }>;

function toPendingParticipant(row: PendingRow): PendingParticipant {
  return {
    id: row.id,
    code: row.code,
    name: `${row.firstName} ${row.lastName}`.trim(),
    firstName: row.firstName,
    lastName: row.lastName,
    role: row.role,
    roleLabel: participantRoleLabel(row.role),
    position: row.position,
    country: row.country,
    school: row.school?.name ?? null,
    committee: row.committee?.name ?? null,
    committeeShort: row.committee?.shortName ?? null,
    dietaryNotes: row.dietaryNotes,
  };
}

function percentageOf(registered: number, expected: number): number {
  if (expected <= 0) return registered > 0 ? 100 : 0;
  return Math.min(Math.round((registered / expected) * 100), 100);
}

/**
 * Panel en tiempo real (RF-16 y RF-17).
 *
 * El evento es pequeño (~200 participantes y unas decenas de puntos), así que la
 * agregación se hace en memoria con tres consultas: participantes activos,
 * puntos y los escaneos de esos puntos. Eso evita SQL crudo y mantiene una sola
 * definición de "esperado": los participantes activos cuyo rol aplica al punto.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(query: QueryDashboardDto): Promise<DashboardSummary> {
    const now = new Date();
    const checkpointId = query.checkpointId ?? query.checkpoint_id;

    const checkpointWhere: Prisma.CheckpointWhereInput = {};
    if (query.day) checkpointWhere.day = parseDay(query.day);
    if (checkpointId) checkpointWhere.id = checkpointId;

    const [checkpoints, participants, dayRows] = await Promise.all([
      this.prisma.checkpoint.findMany({
        where: checkpointWhere,
        select: CHECKPOINT_SELECT,
        orderBy: [{ day: 'asc' }, { startsAt: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.participant.findMany({
        where: { isActive: true },
        select: { id: true, role: true, schoolId: true, school: { select: { name: true } } },
      }),
      // Los días del programa completo: el selector de la pantalla no debe
      // encogerse al filtrar por un día.
      this.prisma.checkpoint.findMany({
        distinct: ['day'],
        select: { day: true },
        orderBy: { day: 'asc' },
      }),
    ]);

    const scans =
      checkpoints.length === 0
        ? []
        : await this.prisma.scan.findMany({
            where: { checkpointId: { in: checkpoints.map((checkpoint) => checkpoint.id) } },
            select: { checkpointId: true, participantId: true, result: true, scannedAt: true },
          });

    const roleTotals = new Map<string, number>();
    const participantRole = new Map<number, string>();
    const participantSchool = new Map<number, number | null>();
    const schoolNames = new Map<number | null, string>();
    const schoolTotals = new Map<number | null, number>();
    const schoolRoleTotals = new Map<string, number>();

    participants.forEach((participant) => {
      roleTotals.set(participant.role, (roleTotals.get(participant.role) ?? 0) + 1);
      participantRole.set(participant.id, participant.role);
      participantSchool.set(participant.id, participant.schoolId ?? null);

      const schoolKey = participant.schoolId ?? null;
      schoolNames.set(schoolKey, participant.school?.name ?? 'Sin colegio');
      schoolTotals.set(schoolKey, (schoolTotals.get(schoolKey) ?? 0) + 1);

      const roleKey = `${schoolKey}|${participant.role}`;
      schoolRoleTotals.set(roleKey, (schoolRoleTotals.get(roleKey) ?? 0) + 1);
    });

    const expectedFor = (checkpoint: CheckpointRow): number => {
      const roles = checkpoint.appliesToRoles;
      if (!roles || roles.length === 0) return participants.length;
      return roles.reduce((total, role) => total + (roleTotals.get(role) ?? 0), 0);
    };

    const schoolKeys = Array.from(schoolTotals.keys());

    const checkpointProgress: CheckpointProgress[] = checkpoints.map((checkpoint) => {
      const roles = checkpoint.appliesToRoles && checkpoint.appliesToRoles.length > 0 ? checkpoint.appliesToRoles : null;
      const rows = scans.filter((scan) => scan.checkpointId === checkpoint.id);
      const valid = rows.filter((scan) => VALID_SCAN_RESULTS.includes(scan.result));
      const expected = expectedFor(checkpoint);
      const registered = valid.length;

      const lastScan = rows.reduce<Date | null>(
        (latest, scan) => (!latest || scan.scannedAt > latest ? scan.scannedAt : latest),
        null,
      );

      const byRole = (roles ?? (Object.values(ParticipantRole) as ParticipantRole[]))
        .map((role) => ({
          role,
          label: participantRoleLabel(role),
          expected: roleTotals.get(role) ?? 0,
          registered: valid.filter(
            (scan) => scan.participantId !== null && participantRole.get(scan.participantId) === role,
          ).length,
        }))
        .filter((item) => item.expected > 0 || item.registered > 0);

      const bySchool = schoolKeys
        .map((schoolKey) => {
          const schoolExpected = roles
            ? roles.reduce((total, role) => total + (schoolRoleTotals.get(`${schoolKey}|${role}`) ?? 0), 0)
            : schoolTotals.get(schoolKey) ?? 0;

          const schoolRegistered = valid.filter(
            (scan) => scan.participantId !== null && participantSchool.get(scan.participantId) === schoolKey,
          ).length;

          return {
            schoolId: schoolKey,
            school: schoolNames.get(schoolKey) ?? 'Sin colegio',
            expected: schoolExpected,
            registered: schoolRegistered,
            pending: Math.max(schoolExpected - schoolRegistered, 0),
          };
        })
        .filter((item) => item.expected > 0 || item.registered > 0)
        .sort((a, b) => b.expected - a.expected);

      return {
        id: checkpoint.id,
        name: checkpoint.name,
        type: checkpoint.type,
        typeLabel: CHECKPOINT_TYPE_LABELS[checkpoint.type],
        day: checkpoint.day.toISOString().slice(0, 10),
        dayLabel: formatDayLabel(checkpoint.day.toISOString().slice(0, 10)),
        windowLabel: toCheckpointView(checkpoint, now).windowLabel,
        status: describeCheckpointStatus(evaluateCheckpointWindow(checkpoint, now), toDayString(now)),
        expected,
        registered,
        pending: Math.max(expected - registered, 0),
        percentage: percentageOf(registered, expected),
        exceptions: valid.filter((scan) => scan.result === 'excepcion').length,
        voided: rows.filter((scan) => scan.result === 'anulado').length,
        rejected: rows.filter((scan) => REJECTED_SCAN_RESULTS.includes(scan.result)).length,
        duplicates: rows.filter((scan) => scan.result === 'duplicado').length,
        lastScanAt: lastScan ? toZonedIso(lastScan) : null,
        lastScanAtLabel: lastScan ? toTimeLabel(lastScan) : null,
        byRole,
        bySchool,
      };
    });

    const validScans = scans.filter((scan) => VALID_SCAN_RESULTS.includes(scan.result));
    const attendedIds = new Set(
      validScans.map((scan) => scan.participantId).filter((id): id is number => id !== null),
    );

    const typeKeys = Array.from(new Set(checkpoints.map((checkpoint) => checkpoint.type)));
    const byType = typeKeys
      .map((type) => {
        const items = checkpointProgress.filter((item) => item.type === type);
        const expected = items.reduce((total, item) => total + item.expected, 0);
        const registered = items.reduce((total, item) => total + item.registered, 0);
        return {
          type,
          label: CHECKPOINT_TYPE_LABELS[type],
          expected,
          registered,
          pending: Math.max(expected - registered, 0),
          percentage: percentageOf(registered, expected),
        };
      })
      .sort((a, b) => b.expected - a.expected);

    const bySchool: SchoolProgress[] = schoolKeys
      .map((schoolKey) => {
        const expected = schoolTotals.get(schoolKey) ?? 0;
        const registered = Array.from(attendedIds).filter(
          (participantId) => participantSchool.get(participantId) === schoolKey,
        ).length;
        return {
          schoolId: schoolKey,
          school: schoolNames.get(schoolKey) ?? 'Sin colegio',
          expected,
          registered,
          pending: Math.max(expected - registered, 0),
          percentage: percentageOf(registered, expected),
        };
      })
      .sort((a, b) => b.expected - a.expected);

    const byResult = Array.from(
      scans.reduce((map, scan) => map.set(scan.result, (map.get(scan.result) ?? 0) + 1), new Map<string, number>()),
    )
      .map(([result, count]) => ({
        result,
        label: scanResultLabel(result),
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      generatedAt: toZonedIso(now),
      generatedAtLabel: `${toTimeLabel(now)}`,
      event: {
        name: process.env.EVENT_NAME ?? 'ASMUN',
        timezone: process.env.EVENT_TIMEZONE ?? 'America/La_Paz',
        today: toDayString(now),
        days: dayRows.map((row) => row.day.toISOString().slice(0, 10)),
      },
      totals: {
        activeParticipants: participants.length,
        attendedParticipants: attendedIds.size,
        attendancePercentage: percentageOf(attendedIds.size, participants.length),
        checkpoints: checkpoints.length,
        openCheckpoints: checkpointProgress.filter((item) => item.status.isOpen).length,
        validScans: validScans.length,
        exceptions: validScans.filter((scan) => scan.result === 'excepcion').length,
        rejectedScans: scans.filter((scan) => REJECTED_SCAN_RESULTS.includes(scan.result)).length,
        voidedScans: scans.filter((scan) => scan.result === 'anulado').length,
        byResult,
      },
      checkpoints: checkpointProgress,
      byType,
      bySchool,
    };
  }

  /** Pendientes de un punto, paginados para la tabla del panel (RF-17). */
  async pending(query: QueryPendingDto): Promise<
    PaginatedResult<PendingParticipant> & { checkpoint: ReturnType<typeof toCheckpointView> }
  > {
    const checkpointId = query.checkpointId ?? query.checkpoint_id;
    if (!checkpointId) {
      throw new BadRequestException({
        code: 'CHECKPOINT_REQUIRED',
        message: 'Indique el punto de control (checkpointId) para listar los pendientes.',
      });
    }

    const { page, limit, skip, take } = resolvePagination(query.page, query.limit);
    const { checkpoint, where } = await this.buildPendingQuery({
      checkpointId,
      schoolId: query.schoolId ?? query.school,
      role: query.role,
      search: query.search,
    });

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.participant.findMany({
        where,
        select: PENDING_SELECT,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take,
      }),
      this.prisma.participant.count({ where }),
    ]);

    return {
      checkpoint: toCheckpointView(checkpoint),
      ...paginate(rows.map(toPendingParticipant), total, page, limit),
    };
  }

  /** Lista completa de pendientes, sin paginar (usada por la exportación a Excel). */
  async pendingList(params: {
    checkpointId: number;
    schoolId?: number;
    role?: ParticipantRole;
    search?: string;
  }): Promise<{ checkpoint: CheckpointRow; participants: PendingParticipant[] }> {
    const { checkpoint, where } = await this.buildPendingQuery(params);

    const rows = await this.prisma.participant.findMany({
      where,
      select: PENDING_SELECT,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return { checkpoint, participants: rows.map(toPendingParticipant) };
  }

  /**
   * "Esperado" = participantes activos cuyo rol aplica al punto. Pendiente =
   * esperado menos quienes ya tienen un escaneo válido (ok o excepción).
   */
  private async buildPendingQuery(params: {
    checkpointId: number;
    schoolId?: number;
    role?: ParticipantRole;
    search?: string;
  }): Promise<{ checkpoint: CheckpointRow; where: Prisma.ParticipantWhereInput }> {
    const checkpoint = await this.prisma.checkpoint.findUnique({
      where: { id: params.checkpointId },
      select: CHECKPOINT_SELECT,
    });

    if (!checkpoint) {
      throw new NotFoundException({
        code: 'CHECKPOINT_NOT_FOUND',
        message: `No existe un punto de control con id ${params.checkpointId}`,
      });
    }

    const completed = await this.prisma.scan.findMany({
      where: { checkpointId: checkpoint.id, result: { in: VALID_SCAN_RESULTS } },
      select: { participantId: true },
    });

    const completedIds = completed
      .map((scan) => scan.participantId)
      .filter((id): id is number => id !== null);

    const and: Prisma.ParticipantWhereInput[] = [{ isActive: true }];

    const roles = checkpoint.appliesToRoles;
    if (roles && roles.length > 0) and.push({ role: { in: roles } });
    if (params.role) and.push({ role: params.role });
    if (params.schoolId) and.push({ schoolId: params.schoolId });

    const searchFilter = buildParticipantSearchFilter(params.search);
    if (searchFilter) and.push(searchFilter);
    if (completedIds.length > 0) and.push({ id: { notIn: completedIds } });

    return { checkpoint, where: { AND: and } };
  }
}
