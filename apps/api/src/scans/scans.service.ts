import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, ScanResult, ScanSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CheckpointRow, CheckpointsService, toCheckpointView } from '../checkpoints/checkpoints.service';
import {
  WindowEvaluation,
  appliesToRole,
  describeWindowFailure,
  evaluateCheckpointWindow,
  isMealCheckpoint,
} from '../checkpoints/checkpoint-window.util';
import { normalizeShortCode } from '../common/utils/code-generator.util';
import {
  formatDayLabel,
  parseDay,
  parseInstant,
  toDayString,
  toTimeLabel,
  toZonedIso,
} from '../common/utils/datetime.util';
import { paginate, PaginatedResult, resolvePagination } from '../common/dto/pagination.dto';
import { participantRoleLabel } from '../common/constants/participant-role.constants';
import {
  SCAN_SOURCE_LABELS,
  VALID_SCAN_RESULTS,
  checkpointTypeLabel,
  scanResultLabel,
} from '../common/constants/scan.constants';
import { buildParticipantSearchFilter } from '../common/utils/participant-search.util';
import {
  CreateScanDto,
  OverrideScanDto,
  QueryScansDto,
  SearchParticipantsDto,
  VoidScanDto,
} from './dto/scan.dto';

/** Resultados que ocupan el "un solo uso" garantizado por `ux_scan_once`. */
const VALID_RESULTS: ScanResult[] = VALID_SCAN_RESULTS;

/** Semáforo del SDD 9.2 (el frontend agrega ícono y sonido). */
export const SCAN_COLOR_BY_RESULT: Record<ScanResult, ScanColor> = {
  ok: 'verde',
  excepcion: 'verde',
  duplicado: 'rojo',
  no_encontrado: 'rojo',
  no_habilitado: 'rojo',
  fuera_de_horario: 'amarillo',
  falta_requisito: 'amarillo',
  anulado: 'amarillo',
};

/** Elemento del historial de escaneos (pantalla de auditoría). */
export interface ScanListItem {
  id: string;
  result: string;
  resultLabel: string;
  color: ScanColor;
  source: string;
  sourceLabel: string;
  scannedAt: string;
  dateLabel: string;
  timeLabel: string;
  note: string | null;
  participant: {
    id: number;
    code: string;
    name: string;
    role: string;
    roleLabel: string;
    school: string | null;
  } | null;
  checkpoint: { id: number; name: string; type: string; typeLabel: string; day: string; dayLabel: string };
  user: { id: number; fullName: string };
  voided: { by: string | null; reason: string | null } | null;
}

export type ScanColor = 'verde' | 'amarillo' | 'rojo';

const SCAN_LIST_SELECT = {
  id: true,
  result: true,
  source: true,
  scannedAt: true,
  note: true,
  voidedReason: true,
  participant: {
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      role: true,
      school: { select: { name: true } },
    },
  },
  checkpoint: { select: { id: true, name: true, type: true, day: true } },
  user: { select: { id: true, fullName: true } },
  voidedByUser: { select: { fullName: true } },
} satisfies Prisma.ScanSelect;

type ScanListRow = Prisma.ScanGetPayload<{ select: typeof SCAN_LIST_SELECT }>;

function toScanListItem(row: ScanListRow): ScanListItem {
  const day = toDayString(row.scannedAt);

  return {
    id: row.id,
    result: row.result,
    resultLabel: scanResultLabel(row.result),
    color: SCAN_COLOR_BY_RESULT[row.result] ?? 'rojo',
    source: row.source,
    sourceLabel: SCAN_SOURCE_LABELS[row.source] ?? row.source,
    scannedAt: toZonedIso(row.scannedAt),
    dateLabel: formatDayLabel(day),
    timeLabel: toTimeLabel(row.scannedAt),
    note: row.note,
    participant: row.participant
      ? {
          id: row.participant.id,
          code: row.participant.code,
          name: `${row.participant.firstName} ${row.participant.lastName}`.trim(),
          role: row.participant.role,
          roleLabel: participantRoleLabel(row.participant.role),
          school: row.participant.school?.name ?? null,
        }
      : null,
    checkpoint: {
      id: row.checkpoint.id,
      name: row.checkpoint.name,
      type: row.checkpoint.type,
      typeLabel: checkpointTypeLabel(row.checkpoint.type),
      day: row.checkpoint.day.toISOString().slice(0, 10),
      dayLabel: formatDayLabel(row.checkpoint.day.toISOString().slice(0, 10)),
    },
    user: { id: row.user.id, fullName: row.user.fullName },
    voided:
      row.result === 'anulado' || row.voidedReason || row.voidedByUser
        ? { by: row.voidedByUser?.fullName ?? null, reason: row.voidedReason ?? null }
        : null,
  };
}

const SCAN_PARTICIPANT_SELECT = {
  id: true,
  code: true,
  firstName: true,
  lastName: true,
  role: true,
  position: true,
  country: true,
  dietaryNotes: true,
  isActive: true,
  school: { select: { id: true, name: true } },
  committee: { select: { id: true, name: true, shortName: true } },
} satisfies Prisma.ParticipantSelect;

type ScanParticipantRow = Prisma.ParticipantGetPayload<{ select: typeof SCAN_PARTICIPANT_SELECT }>;

const SCAN_SELECT = {
  id: true,
  result: true,
  source: true,
  scannedAt: true,
  note: true,
  participantId: true,
  checkpointId: true,
  userId: true,
  user: { select: { id: true, fullName: true } },
} satisfies Prisma.ScanSelect;

type ScanRow = Prisma.ScanGetPayload<{ select: typeof SCAN_SELECT }>;

export interface ScanParticipantView {
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
  isActive: boolean;
}

export interface ScanOutcome {
  /** Id del escaneo registrado (todo intento queda registrado, RNF-05). */
  id: string;
  result: ScanResult;
  color: ScanColor;
  message: string;
  /** `true` cuando ocupó el punto (ok o excepción). */
  registered: boolean;
  participant: ScanParticipantView | null;
  checkpoint: ReturnType<typeof toCheckpointView>;
  source: ScanSource;
  scannedAt: string;
  scannedAtLabel: string;
  previous: { scanId: string; at: string; atLabel: string; by: string } | null;
  requirement: { id: number; name: string } | null;
  window: { opensAt: string | null; closesAt: string | null } | null;
  exception: { reason: string; waived: string[] } | null;
  /** Alerta de restricciones alimentarias (RF-13). */
  dietaryAlert: boolean;
  dietaryNotes: string | null;
}

@Injectable()
export class ScansService {
  private readonly logger = new Logger(ScansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly checkpoints: CheckpointsService,
  ) {}

  /**
   * Motor de validación (SDD 9.1). El orden importa: se detiene en el primer
   * fallo y **todo intento se registra**, incluidos los rechazados, porque el
   * historial de quién intentó qué es parte de la auditoría del evento.
   */
  async register(dto: CreateScanDto, user: AuthUser): Promise<ScanOutcome> {
    const checkpointId = dto.checkpointId ?? dto.checkpoint_id;
    if (!checkpointId) {
      throw new BadRequestException({
        code: 'CHECKPOINT_REQUIRED',
        message: 'Debe indicar el punto de control (checkpointId o checkpoint_id).',
      });
    }
    const checkpoint = await this.checkpoints.assertCanOperate(user, checkpointId);
    const source = this.resolveSource(dto);
    const now = new Date();
    this.assertParticipantReference(dto);

    // 1. ¿Existe el código y el participante está activo?
    const participant = await this.resolveParticipant(dto);

    if (!participant) {
      return this.reject({
        checkpoint,
        participant: null,
        result: ScanResult.no_encontrado,
        message: 'Código no encontrado. Verifique o busque por nombre.',
        userId: user.id,
        source,
        note: dto.code ? `Código '${normalizeShortCode(dto.code) || dto.code}' no encontrado` : 'Sin código ni participante',
        now,
      });
    }

    if (!participant.isActive) {
      return this.reject({
        checkpoint,
        participant,
        result: ScanResult.no_encontrado,
        message: 'El participante está desactivado. Consulte con acreditación.',
        userId: user.id,
        source,
        note: 'Participante desactivado',
        now,
      });
    }

    // 2. ¿El punto aplica al rol del participante?
    if (!appliesToRole(checkpoint.appliesToRoles, participant.role)) {
      return this.reject({
        checkpoint,
        participant,
        result: ScanResult.no_habilitado,
        message: `No habilitado para '${checkpoint.name}'. Consulte con acreditación.`,
        userId: user.id,
        source,
        note: `Rol ${participant.role} no habilitado en el punto`,
        now,
      });
    }

    // 3. ¿Estamos en el día y dentro de la ventana horaria?
    const window = evaluateCheckpointWindow(checkpoint, now);
    if (!window.open) {
      const isDisabled = window.failure === 'desactivado';
      return this.reject({
        checkpoint,
        participant,
        result: isDisabled ? ScanResult.no_habilitado : ScanResult.fuera_de_horario,
        message: describeWindowFailure(window, checkpoint.name),
        userId: user.id,
        source,
        note: `Ventana: ${window.failure}`,
        window,
        now,
      });
    }

    // 4. ¿Existe una dependencia sin cumplir? (por ejemplo, material sin credencial)
    const requirement = await this.findUnmetRequirement(checkpoint, participant.id);
    if (requirement) {
      return this.reject({
        checkpoint,
        participant,
        result: ScanResult.falta_requisito,
        message: `Falta registrar '${requirement.name}' primero.`,
        userId: user.id,
        source,
        note: `Falta el requisito '${requirement.name}'`,
        requirement,
        now,
      });
    }

    // 5. ¿Ya existe un escaneo válido para ese punto?
    const previous = await this.findValidScan(participant.id, checkpoint.id);
    if (previous) {
      return this.reject({
        checkpoint,
        participant,
        result: ScanResult.duplicado,
        message: this.duplicateMessage(checkpoint.name, previous.scannedAt),
        userId: user.id,
        source,
        note: 'Escaneo duplicado',
        previous,
        now,
      });
    }

    // 6. Registro. Si dos dispositivos escanean a la vez, el índice único
    //    ux_scan_once deja pasar solo uno y el otro vuelve como duplicado.
    try {
      const created = await this.prisma.scan.create({
        data: {
          participantId: participant.id,
          checkpointId: checkpoint.id,
          userId: user.id,
          result: ScanResult.ok,
          source,
        },
        select: SCAN_SELECT,
      });

      return this.buildOutcome({
        scan: created,
        checkpoint,
        participant,
        result: ScanResult.ok,
        message: `${this.fullName(participant)} — registrado en '${checkpoint.name}'.`,
        now,
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;

      const raced = await this.findValidScan(participant.id, checkpoint.id);
      this.logger.warn(
        `Carrera de unicidad en el punto ${checkpoint.id} para el participante ${participant.id}: se respondió duplicado.`,
      );

      return this.reject({
        checkpoint,
        participant,
        result: ScanResult.duplicado,
        message: raced
          ? this.duplicateMessage(checkpoint.name, raced.scannedAt)
          : `Ya estaba registrado en '${checkpoint.name}'.`,
        userId: user.id,
        source,
        note: 'Carrera de dos dispositivos sobre el mismo punto',
        previous: raced,
        now,
      });
    }
  }

  /**
   * Excepción autorizada (SDD 9.3, RF-14). Salta rol, horario y dependencia,
   * pero **no** la regla de un solo uso ni la existencia del participante: por
   * eso la base sigue garantizando que nadie reciba algo dos veces.
   */
  async override(dto: OverrideScanDto, user: AuthUser): Promise<ScanOutcome> {
    const checkpointId = dto.checkpointId ?? dto.checkpoint_id;
    if (!checkpointId) {
      throw new BadRequestException({
        code: 'CHECKPOINT_REQUIRED',
        message: 'Debe indicar el punto de control (checkpointId o checkpoint_id).',
      });
    }
    const checkpoint = await this.checkpoints.assertCanOperate(user, checkpointId);
    const source = this.resolveSource(dto);
    const now = new Date();
    const reason = dto.reason.trim();
    this.assertParticipantReference(dto);

    const participant = await this.resolveParticipant(dto);

    if (!participant) {
      return this.reject({
        checkpoint,
        participant: null,
        result: ScanResult.no_encontrado,
        message: 'Código no encontrado. Verifique o busque por nombre.',
        userId: user.id,
        source,
        note: `Excepción solicitada con código '${normalizeShortCode(dto.code) || dto.code}' no encontrado. Motivo: ${reason}`,
        now,
      });
    }

    if (!participant.isActive) {
      return this.reject({
        checkpoint,
        participant,
        result: ScanResult.no_encontrado,
        message: 'El participante está desactivado. Reactívelo antes de autorizar una excepción.',
        userId: user.id,
        source,
        note: `Excepción rechazada: participante desactivado. Motivo: ${reason}`,
        now,
      });
    }

    const previous = await this.findValidScan(participant.id, checkpoint.id);
    if (previous) {
      return this.reject({
        checkpoint,
        participant,
        result: ScanResult.duplicado,
        message: this.duplicateMessage(checkpoint.name, previous.scannedAt),
        userId: user.id,
        source,
        note: `Excepción rechazada: ya registrado. Motivo: ${reason}`,
        previous,
        now,
      });
    }

    // Qué reglas se están saltando: queda escrito en la auditoría.
    const waived: string[] = [];
    if (!appliesToRole(checkpoint.appliesToRoles, participant.role)) {
      waived.push(`rol '${participant.role}' no habilitado`);
    }
    const window = evaluateCheckpointWindow(checkpoint, now);
    if (!window.open) {
      waived.push(`horario: ${describeWindowFailure(window, checkpoint.name)}`);
    }
    const requirement = await this.findUnmetRequirement(checkpoint, participant.id);
    if (requirement) {
      waived.push(`falta el requisito '${requirement.name}'`);
    }

    try {
      const created = await this.prisma.scan.create({
        data: {
          participantId: participant.id,
          checkpointId: checkpoint.id,
          userId: user.id,
          result: ScanResult.excepcion,
          source,
          note: waived.length > 0 ? `${reason} [excepciones: ${waived.join('; ')}]` : reason,
        },
        select: SCAN_SELECT,
      });

      await this.audit.log({
        userId: user.id,
        action: 'excepcion',
        entity: 'scan',
        entityId: created.id,
        reason: waived.length > 0 ? `${reason} [excepciones: ${waived.join('; ')}]` : reason,
      });

      return this.buildOutcome({
        scan: created,
        checkpoint,
        participant,
        result: ScanResult.excepcion,
        message: `Excepción autorizada: ${this.fullName(participant)} — registrado en '${checkpoint.name}'.`,
        exception: { reason, waived },
        window,
        requirement,
        now,
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;

      const raced = await this.findValidScan(participant.id, checkpoint.id);
      return this.reject({
        checkpoint,
        participant,
        result: ScanResult.duplicado,
        message: raced
          ? this.duplicateMessage(checkpoint.name, raced.scannedAt)
          : `Ya estaba registrado en '${checkpoint.name}'.`,
        userId: user.id,
        source,
        note: 'Carrera de dos dispositivos durante una excepción',
        previous: raced,
        now,
      });
    }
  }

  /**
   * Anulación de un escaneo por error (RF-15). Pasa el resultado a `anulado`, lo
   * que libera el índice único y permite registrar de nuevo a esa persona.
   */
  async void(scanId: string, dto: VoidScanDto, user: AuthUser) {
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      select: {
        id: true,
        result: true,
        scannedAt: true,
        participantId: true,
        checkpointId: true,
        user: { select: { id: true, fullName: true } },
        participant: { select: SCAN_PARTICIPANT_SELECT },
      },
    });

    if (!scan) {
      throw new NotFoundException({
        code: 'SCAN_NOT_FOUND',
        message: `No existe un escaneo con id ${scanId}`,
      });
    }

    if (scan.result === ScanResult.anulado) {
      throw new ConflictException({
        code: 'SCAN_ALREADY_VOIDED',
        message: 'Ese escaneo ya estaba anulado.',
      });
    }

    if (!VALID_RESULTS.includes(scan.result)) {
      throw new ConflictException({
        code: 'SCAN_NOT_VALID',
        message: `Solo se puede anular un escaneo válido (ok o excepción); este quedó como '${scan.result}'.`,
      });
    }

    const reason = dto.reason.trim();

    const updated = await this.prisma.scan.update({
      where: { id: scanId },
      data: {
        result: ScanResult.anulado,
        voidedBy: user.id,
        voidedReason: reason,
      },
      select: SCAN_SELECT,
    });

    await this.audit.log({
      userId: user.id,
      action: 'anular_scan',
      entity: 'scan',
      entityId: scanId,
      reason,
    });

    return {
      id: updated.id,
      result: updated.result,
      message: `Escaneo anulado.${scan.participant ? ` ${this.fullName(scan.participant)} puede volver a registrarse en este punto.` : ''}`,
      voidedReason: reason,
      voidedBy: updated.user,
      voidedAt: toZonedIso(updated.scannedAt),
      scannedAt: toZonedIso(scan.scannedAt),
      scannedAtLabel: toTimeLabel(scan.scannedAt),
      participant: scan.participant ? this.toParticipantView(scan.participant) : null,
    };
  }

  /**
   * Búsqueda por nombre para el registro manual (SDD 8.4). Devuelve solo los
   * datos mínimos para identificar a la persona en la puerta.
   */
  async searchParticipants(dto: SearchParticipantsDto, user: AuthUser) {
    const checkpointId = dto.checkpointId ?? dto.checkpoint_id;
    if (!checkpointId) {
      throw new BadRequestException({
        code: 'CHECKPOINT_REQUIRED',
        message: 'Debe indicar el punto de control (checkpointId o checkpoint_id).',
      });
    }
    const checkpoint = await this.checkpoints.assertCanOperate(user, checkpointId);
    const searchFilter = buildParticipantSearchFilter(dto.q);

    const rows = await this.prisma.participant.findMany({
      where: { isActive: true, ...(searchFilter ?? {}) },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        role: true,
        school: { select: { name: true } },
        committee: { select: { shortName: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 20,
    });

    return {
      checkpoint: { id: checkpoint.id, name: checkpoint.name },
      data: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: `${row.firstName} ${row.lastName}`.trim(),
        firstName: row.firstName,
        lastName: row.lastName,
        role: row.role,
        roleLabel: participantRoleLabel(row.role),
        school: row.school?.name ?? null,
        committeeShort: row.committee?.shortName ?? null,
      })),
    };
  }

  /**
   * Historial de escaneos con filtros, para la pantalla de auditoría: permite
   * revisar qué pasó en cada puerta y anular un registro equivocado (RF-15).
   */
  async findAllScans(query: QueryScansDto): Promise<PaginatedResult<ScanListItem>> {
    const { page, limit, skip, take } = resolvePagination(query.page, query.limit);
    const and: Prisma.ScanWhereInput[] = [];

    const checkpointId = query.checkpointId ?? query.checkpoint_id;
    if (checkpointId) and.push({ checkpointId });
    if (query.day) and.push({ checkpoint: { day: parseDay(query.day) } });
    if (query.from) and.push({ scannedAt: { gte: parseInstant(`${query.from}T00:00:00`) } });
    if (query.to) and.push({ scannedAt: { lte: parseInstant(`${query.to}T23:59:59.999`) } });
    if (query.result) and.push({ result: query.result });
    if (query.source) and.push({ source: query.source });
    if (query.userId) and.push({ userId: query.userId });
    if (query.schoolId) and.push({ participant: { schoolId: query.schoolId } });

    const searchFilter = buildParticipantSearchFilter(query.search);
    if (searchFilter) and.push({ participant: searchFilter });

    const where: Prisma.ScanWhereInput = and.length > 0 ? { AND: and } : {};

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.scan.findMany({
        where,
        select: SCAN_LIST_SELECT,
        orderBy: { scannedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.scan.count({ where }),
    ]);

    return paginate(rows.map(toScanListItem), total, page, limit);
  }

  /* ------------------------------------------------------------------ */
  /* Internos                                                            */
  /* ------------------------------------------------------------------ */

  private assertParticipantReference(dto: CreateScanDto): void {
    if (!dto.code && !dto.participantId) {
      throw new BadRequestException({
        code: 'MISSING_PARTICIPANT',
        message: 'Envíe el código corto (code) o el id del participante (participantId).',
      });
    }
  }

  private resolveSource(dto: CreateScanDto): ScanSource {
    if (dto.source) return dto.source;
    return dto.participantId ? ScanSource.busqueda : ScanSource.manual;
  }

  private async resolveParticipant(dto: CreateScanDto): Promise<ScanParticipantRow | null> {
    if (dto.participantId) {
      return this.prisma.participant.findUnique({
        where: { id: dto.participantId },
        select: SCAN_PARTICIPANT_SELECT,
      });
    }

    const code = normalizeShortCode(dto.code);
    if (!code) return null;

    return this.prisma.participant.findUnique({
      where: { code },
      select: SCAN_PARTICIPANT_SELECT,
    });
  }

  private async findValidScan(participantId: number, checkpointId: number) {
    return this.prisma.scan.findFirst({
      where: { participantId, checkpointId, result: { in: VALID_RESULTS } },
      select: { id: true, scannedAt: true, result: true, user: { select: { fullName: true } } },
      orderBy: { scannedAt: 'desc' },
    });
  }

  private async findUnmetRequirement(
    checkpoint: CheckpointRow,
    participantId: number,
  ): Promise<{ id: number; name: string } | null> {
    if (!checkpoint.requiresCheckpointId || !checkpoint.requiresCheckpoint) return null;

    const fulfilled = await this.prisma.scan.findFirst({
      where: {
        participantId,
        checkpointId: checkpoint.requiresCheckpointId,
        result: { in: VALID_RESULTS },
      },
      select: { id: true },
    });

    if (fulfilled) return null;
    return { id: checkpoint.requiresCheckpoint.id, name: checkpoint.requiresCheckpoint.name };
  }

  /** Registra un intento rechazado y arma la respuesta. */
  private async reject(params: {
    checkpoint: CheckpointRow;
    participant: ScanParticipantRow | null;
    result: ScanResult;
    message: string;
    userId: number;
    source: ScanSource;
    note: string;
    now: Date;
    previous?: { id: string; scannedAt: Date; user: { fullName: string } } | null;
    requirement?: { id: number; name: string } | null;
    window?: WindowEvaluation | null;
  }): Promise<ScanOutcome> {
    const scan = await this.prisma.scan.create({
      data: {
        participantId: params.participant?.id ?? null,
        checkpointId: params.checkpoint.id,
        userId: params.userId,
        result: params.result,
        source: params.source,
        note: params.note,
      },
      select: SCAN_SELECT,
    });

    return this.buildOutcome({
      scan,
      checkpoint: params.checkpoint,
      participant: params.participant,
      result: params.result,
      message: params.message,
      previous: params.previous ?? null,
      requirement: params.requirement ?? null,
      window: params.window ?? null,
      now: params.now,
    });
  }

  private buildOutcome(params: {
    scan: ScanRow;
    checkpoint: CheckpointRow;
    participant: ScanParticipantRow | null;
    result: ScanResult;
    message: string;
    previous?: { id: string; scannedAt: Date; user: { fullName: string } } | null;
    requirement?: { id: number; name: string } | null;
    window?: WindowEvaluation | null;
    exception?: { reason: string; waived: string[] } | null;
    now: Date;
  }): ScanOutcome {
    const { scan, checkpoint, participant, previous } = params;

    return {
      id: scan.id,
      result: params.result,
      color: SCAN_COLOR_BY_RESULT[params.result] ?? 'rojo',
      message: params.message,
      registered: VALID_RESULTS.includes(params.result),
      participant: participant ? this.toParticipantView(participant) : null,
      checkpoint: toCheckpointView(checkpoint, params.now),
      source: scan.source,
      scannedAt: toZonedIso(scan.scannedAt),
      scannedAtLabel: toTimeLabel(scan.scannedAt),
      previous: previous
        ? {
            scanId: previous.id,
            at: toZonedIso(previous.scannedAt),
            atLabel: toTimeLabel(previous.scannedAt),
            by: previous.user.fullName,
          }
        : null,
      requirement: params.requirement ?? null,
      window: params.window
        ? {
            opensAt: checkpoint.startsAt ? toZonedIso(checkpoint.startsAt) : null,
            closesAt: checkpoint.endsAt ? toZonedIso(checkpoint.endsAt) : null,
          }
        : null,
      exception: params.exception ?? null,
      dietaryAlert: Boolean(
        participant && participant.dietaryNotes && isMealCheckpoint(checkpoint.type),
      ),
      dietaryNotes: participant?.dietaryNotes ?? null,
    };
  }

  private toParticipantView(participant: ScanParticipantRow): ScanParticipantView {
    return {
      id: participant.id,
      code: participant.code,
      name: this.fullName(participant),
      firstName: participant.firstName,
      lastName: participant.lastName,
      role: participant.role,
      roleLabel: participantRoleLabel(participant.role),
      position: participant.position,
      country: participant.country,
      school: participant.school?.name ?? null,
      committee: participant.committee?.name ?? null,
      committeeShort: participant.committee?.shortName ?? null,
      dietaryNotes: participant.dietaryNotes,
      isActive: participant.isActive,
    };
  }

  private fullName(participant: { firstName: string; lastName: string }): string {
    return `${participant.firstName} ${participant.lastName}`.trim();
  }

  private duplicateMessage(checkpointName: string, scannedAt: Date): string {
    return `Ya recibió '${checkpointName}' a las ${toTimeLabel(scannedAt)}.`;
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
