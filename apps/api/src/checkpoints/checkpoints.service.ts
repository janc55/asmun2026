import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { paginate, PaginatedResult, resolvePagination } from '../common/dto/pagination.dto';
import {
  formatDayLabel,
  parseDay,
  parseInstant,
  toDayString,
  toTimeLabel,
  toZonedIso,
} from '../common/utils/datetime.util';
import { describeCheckpointStatus, evaluateCheckpointWindow, CheckpointStatus } from './checkpoint-window.util';
import { CreateCheckpointDto, QueryCheckpointsDto, UpdateCheckpointDto } from './dto/checkpoint.dto';

export const CHECKPOINT_SELECT = {
  id: true,
  name: true,
  type: true,
  day: true,
  startsAt: true,
  endsAt: true,
  requiresCheckpointId: true,
  requiresCheckpoint: { select: { id: true, name: true, type: true } },
  appliesToRoles: true,
  isActive: true,
  _count: { select: { scans: true, userCheckpoints: true } },
} satisfies Prisma.CheckpointSelect;

export type CheckpointRow = Prisma.CheckpointGetPayload<{ select: typeof CHECKPOINT_SELECT }>;

export interface CheckpointView {
  id: number;
  name: string;
  type: string;
  day: string;
  dayLabel: string;
  startsAt: string | null;
  endsAt: string | null;
  windowLabel: string;
  requiresCheckpointId: number | null;
  requiresCheckpoint: { id: number; name: string; type: string } | null;
  appliesToRoles: string[] | null;
  isActive: boolean;
  scansCount: number;
  operatorsCount: number;
  status: CheckpointStatus;
}

const MAX_DEPENDENCY_DEPTH = 20;

export function buildWindowLabel(startsAt: Date | null, endsAt: Date | null): string {
  if (startsAt && endsAt) return `${toTimeLabel(startsAt)} – ${toTimeLabel(endsAt)}`;
  if (startsAt) return `Desde ${toTimeLabel(startsAt)}`;
  if (endsAt) return `Hasta ${toTimeLabel(endsAt)}`;
  return 'Todo el día';
}

export function toCheckpointView(row: CheckpointRow, now: Date = new Date()): CheckpointView {
  const day = row.day.toISOString().slice(0, 10);
  const evaluation = evaluateCheckpointWindow(row, now);

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    day,
    dayLabel: formatDayLabel(day),
    startsAt: row.startsAt ? toZonedIso(row.startsAt) : null,
    endsAt: row.endsAt ? toZonedIso(row.endsAt) : null,
    windowLabel: buildWindowLabel(row.startsAt, row.endsAt),
    requiresCheckpointId: row.requiresCheckpointId,
    requiresCheckpoint: row.requiresCheckpoint ?? null,
    appliesToRoles: row.appliesToRoles && row.appliesToRoles.length > 0 ? row.appliesToRoles : null,
    isActive: row.isActive,
    scansCount: row._count.scans,
    operatorsCount: row._count.userCheckpoints,
    status: describeCheckpointStatus(evaluation, toDayString(now)),
  };
}

/** Puntos de control del evento (RF-09). */
@Injectable()
export class CheckpointsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryCheckpointsDto): Promise<PaginatedResult<CheckpointView>> {
    const { page, limit, skip, take } = resolvePagination(query.page, query.limit);
    const now = new Date();
    const and: Prisma.CheckpointWhereInput[] = [];

    if (query.search?.trim()) {
      and.push({ name: { contains: query.search.trim(), mode: 'insensitive' } });
    }
    if (query.day) {
      and.push({ day: parseDay(query.day) });
    }
    if (query.type) {
      and.push({ type: query.type });
    }
    if (query.isActive !== undefined && query.isActive !== null) {
      and.push({ isActive: query.isActive });
    }
    if (query.onlyOpen) {
      // "Abierto ahora": mismo criterio que el motor de escaneos (día de hoy y
      // dentro de la ventana), resuelto en SQL para no traer todo y filtrar en memoria.
      and.push({ isActive: true });
      and.push({ day: parseDay(toDayString(now)) });
      and.push({ OR: [{ startsAt: null }, { startsAt: { lte: now } }] });
      and.push({ OR: [{ endsAt: null }, { endsAt: { gte: now } }] });
    }

    const where: Prisma.CheckpointWhereInput = and.length > 0 ? { AND: and } : {};

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.checkpoint.findMany({
        where,
        select: CHECKPOINT_SELECT,
        orderBy: [{ day: 'asc' }, { startsAt: 'asc' }, { name: 'asc' }],
        skip,
        take,
      }),
      this.prisma.checkpoint.count({ where }),
    ]);

    return paginate(rows.map((row) => toCheckpointView(row, now)), total, page, limit);
  }

  async findOne(id: number): Promise<CheckpointView> {
    const row = await this.findRow(id);
    return toCheckpointView(row);
  }

  async create(dto: CreateCheckpointDto): Promise<CheckpointView> {
    const data = await this.buildWriteData(dto);

    const row = await this.prisma.checkpoint.create({
      data: data as Prisma.CheckpointCreateInput,
      select: CHECKPOINT_SELECT,
    });

    return toCheckpointView(row);
  }

  async update(id: number, dto: UpdateCheckpointDto): Promise<CheckpointView> {
    const existing = await this.findRow(id);
    const data = await this.buildWriteData(dto, existing);

    const row = await this.prisma.checkpoint.update({
      where: { id },
      data,
      select: CHECKPOINT_SELECT,
    });

    return toCheckpointView(row);
  }

  async remove(id: number): Promise<{ id: number; deleted: true }> {
    const checkpoint = await this.prisma.checkpoint.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        _count: { select: { scans: true, dependentCheckpoints: true } },
      },
    });

    if (!checkpoint) {
      throw new NotFoundException({
        code: 'CHECKPOINT_NOT_FOUND',
        message: `No existe un punto de control con id ${id}`,
      });
    }

    // El historial de escaneos no se borra (RNF-05): un punto con registros no se elimina.
    if (checkpoint._count.scans > 0) {
      throw new ConflictException({
        code: 'CHECKPOINT_HAS_SCANS',
        message: `No se puede eliminar '${checkpoint.name}': tiene ${checkpoint._count.scans} escaneo(s) registrado(s). Desactívelo en su lugar.`,
      });
    }

    if (checkpoint._count.dependentCheckpoints > 0) {
      throw new ConflictException({
        code: 'CHECKPOINT_HAS_DEPENDENTS',
        message: `No se puede eliminar '${checkpoint.name}': ${checkpoint._count.dependentCheckpoints} punto(s) dependen de él.`,
      });
    }

    await this.prisma.checkpoint.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * Puntos que el usuario puede operar (TASK-3.1 y TASK-3.4).
   *
   * - `admin` y `registrador` (equipo de acreditación): todos los puntos vigentes.
   * - `operador`: solo los que tenga asignados, incluidos los desactivados para
   *   que vea que la asignación existe y por qué no puede registrar.
   * - `lector`: no registra escaneos.
   */
  async findAvailableForUser(user: AuthUser): Promise<CheckpointView[]> {
    if (user.role === 'lector') {
      throw new ForbiddenException({
        code: 'ROLE_NOT_ALLOWED',
        message: 'El rol lector no puede registrar escaneos.',
      });
    }

    const now = new Date();
    const where: Prisma.CheckpointWhereInput =
      user.role === 'operador'
        ? { userCheckpoints: { some: { userId: user.id } } }
        : { isActive: true };

    const rows = await this.prisma.checkpoint.findMany({
      where,
      select: CHECKPOINT_SELECT,
      orderBy: [{ day: 'asc' }, { startsAt: 'asc' }, { name: 'asc' }],
    });

    return rows.map((row) => toCheckpointView(row, now));
  }

  /**
   * Verifica que el usuario pueda registrar en el punto y devuelve el punto con
   * su dependencia resuelta. Es el único lugar donde se decide ese permiso, para
   * que el motor de escaneos y la búsqueda manual compartan la misma regla.
   */
  async assertCanOperate(user: AuthUser, checkpointId: number): Promise<CheckpointRow> {
    const checkpoint = await this.findRow(checkpointId);

    if (user.role === 'lector') {
      throw new ForbiddenException({
        code: 'ROLE_NOT_ALLOWED',
        message: 'El rol lector no puede registrar escaneos.',
      });
    }

    // SDD 13: un operador solo registra en los puntos que tiene asignados.
    if (user.role === 'operador') {
      const assignment = await this.prisma.userCheckpoint.findUnique({
        where: { userId_checkpointId: { userId: user.id, checkpointId } },
        select: { userId: true },
      });

      if (!assignment) {
        throw new ForbiddenException({
          code: 'CHECKPOINT_NOT_ASSIGNED',
          message: `No tiene asignado el punto '${checkpoint.name}'. Consulte con la organización.`,
        });
      }
    }

    return checkpoint;
  }

  private async findRow(id: number): Promise<CheckpointRow> {
    const row = await this.prisma.checkpoint.findUnique({ where: { id }, select: CHECKPOINT_SELECT });

    if (!row) {
      throw new NotFoundException({
        code: 'CHECKPOINT_NOT_FOUND',
        message: `No existe un punto de control con id ${id}`,
      });
    }

    return row;
  }

  /**
   * Valida y arma los datos de escritura. En una edición solo se escriben las
   * claves enviadas, pero la validación usa los valores que quedarán vigentes
   * (por ejemplo, la ventana resultante de cambiar solo el fin).
   */
  private async buildWriteData(
    dto: CreateCheckpointDto | UpdateCheckpointDto,
    existing?: CheckpointRow,
  ): Promise<Prisma.CheckpointUncheckedUpdateInput> {
    const data: Prisma.CheckpointUncheckedUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const effectiveDay = dto.day !== undefined ? parseDay(dto.day) : existing?.day ?? null;
    if (dto.day !== undefined) data.day = effectiveDay as Date;

    const effectiveStartsAt =
      dto.startsAt !== undefined ? this.parseOptionalInstant(dto.startsAt) : existing?.startsAt ?? null;
    const effectiveEndsAt =
      dto.endsAt !== undefined ? this.parseOptionalInstant(dto.endsAt) : existing?.endsAt ?? null;

    if (dto.startsAt !== undefined) data.startsAt = effectiveStartsAt;
    if (dto.endsAt !== undefined) data.endsAt = effectiveEndsAt;

    if (
      effectiveStartsAt &&
      effectiveEndsAt &&
      effectiveStartsAt.getTime() >= effectiveEndsAt.getTime()
    ) {
      throw new BadRequestException({
        code: 'INVALID_WINDOW',
        message: 'El inicio de la ventana horaria debe ser anterior a su fin.',
      });
    }

    if (dto.appliesToRoles !== undefined) {
      const roles = dto.appliesToRoles && dto.appliesToRoles.length > 0 ? dto.appliesToRoles : [];
      data.appliesToRoles = roles.length > 0 ? roles : null;
    }

    if (dto.requiresCheckpointId !== undefined) {
      data.requiresCheckpointId = dto.requiresCheckpointId;
    }

    const effectiveDependencyId =
      dto.requiresCheckpointId !== undefined
        ? dto.requiresCheckpointId
        : existing?.requiresCheckpointId ?? null;

    await this.assertDependency(effectiveDependencyId, existing?.id ?? null, effectiveDay);

    return data;
  }

  /** Valida la dependencia: existe, no es el mismo punto, no retrocede en el tiempo y no genera ciclo. */
  private async assertDependency(
    requiresCheckpointId: number | null | undefined,
    currentId: number | null,
    effectiveDay: Date | null,
  ): Promise<void> {
    if (requiresCheckpointId === null || requiresCheckpointId === undefined) return;

    if (currentId !== null && requiresCheckpointId === currentId) {
      throw new BadRequestException({
        code: 'DEPENDENCY_SELF',
        message: 'Un punto de control no puede depender de sí mismo.',
      });
    }

    const dependency = await this.prisma.checkpoint.findUnique({
      where: { id: requiresCheckpointId },
      select: { id: true, name: true, day: true, requiresCheckpointId: true },
    });

    if (!dependency) {
      throw new BadRequestException({
        code: 'DEPENDENCY_NOT_FOUND',
        message: `El punto del que depende (id ${requiresCheckpointId}) no existe.`,
      });
    }

    if (effectiveDay && dependency.day.getTime() > effectiveDay.getTime()) {
      throw new BadRequestException({
        code: 'DEPENDENCY_DAY_ORDER',
        message: `El punto '${dependency.name}' es de un día posterior; una dependencia debe ser del mismo día o de un día anterior.`,
      });
    }

    // Un ciclo dejaría un punto imposible de cumplir para siempre.
    let cursor: { requiresCheckpointId: number | null } | null = dependency;
    let depth = 0;

    while (cursor?.requiresCheckpointId && depth < MAX_DEPENDENCY_DEPTH) {
      if (currentId !== null && cursor.requiresCheckpointId === currentId) {
        throw new BadRequestException({
          code: 'DEPENDENCY_CYCLE',
          message: `La dependencia genera un ciclo: '${dependency.name}' termina dependiendo de este punto.`,
        });
      }

      cursor = await this.prisma.checkpoint.findUnique({
        where: { id: cursor.requiresCheckpointId },
        select: { requiresCheckpointId: true },
      });
      depth += 1;
    }
  }

  private parseOptionalInstant(value: string | null | undefined): Date | null {
    if (value === null || value === undefined || value === '') return null;

    const date = parseInstant(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_DATETIME',
        message: `'${value}' no es una fecha válida. Use ISO 8601, por ejemplo 2026-10-23T12:00:00-04:00.`,
      });
    }

    return date;
  }
}
