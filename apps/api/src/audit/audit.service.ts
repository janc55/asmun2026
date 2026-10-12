import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginationMeta, resolvePagination } from '../common/dto/pagination.dto';
import { auditActionLabel } from '../common/constants/scan.constants';
import { formatDayLabel, parseInstant, toDayString, toTimeLabel } from '../common/utils/datetime.util';
import { QueryAuditDto } from './dto/audit.dto';

/** Acciones auditadas del sistema (SDD sección 7.2 y RNF-05). */
export type AuditAction = 'excepcion' | 'anular_scan' | 'reimpresion';

export interface AuditEntry {
  /** Usuario responsable de la acción. */
  userId?: number | null;
  action: AuditAction | string;
  /** Entidad afectada: `participant`, `scan`, `badge`, ... */
  entity: string;
  entityId?: string | number | null;
  reason?: string | null;
}

export interface AuditView {
  id: string;
  action: string;
  actionLabel: string;
  entity: string;
  entityId: string | null;
  reason: string | null;
  createdAt: string;
  dateLabel: string;
  timeLabel: string;
  createdAtLabel: string;
  user: { id: number; username: string; fullName: string; role: string } | null;
}

export interface AuditListResult {
  data: AuditView[];
  meta: PaginationMeta & {
    /** Acciones y usuarios presentes en la auditoría, para los filtros de la pantalla. */
    filters: {
      actions: Array<{ action: string; label: string; count: number }>;
      users: Array<{ id: number; fullName: string; username: string; role: string }>;
    };
  };
}

const AUDIT_SELECT = {
  id: true,
  action: true,
  entity: true,
  entityId: true,
  reason: true,
  createdAt: true,
  user: { select: { id: true, username: true, fullName: true, role: true } },
} satisfies Prisma.AuditLogSelect;

type AuditRow = Prisma.AuditLogGetPayload<{ select: typeof AUDIT_SELECT }>;

function toView(row: AuditRow): AuditView {
  const day = toDayString(row.createdAt);
  const time = toTimeLabel(row.createdAt);

  return {
    // `audit_log.id` es BIGSERIAL: se serializa como texto para no perder
    // precisión ni romper `JSON.stringify`.
    id: String(row.id),
    action: row.action,
    actionLabel: auditActionLabel(row.action),
    entity: row.entity,
    entityId: row.entityId,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    dateLabel: formatDayLabel(day),
    timeLabel: time,
    createdAtLabel: `${formatDayLabel(day)} ${time}`,
    user: row.user
      ? { id: row.user.id, username: row.user.username, fullName: row.user.fullName, role: row.user.role }
      : null,
  };
}

/**
 * Escritura y consulta del registro de auditoría (RNF-05).
 *
 * Todo escaneo anulado, excepción y reimpresión queda registrado y no se borra.
 * La escritura nunca debe tumbar la operación de negocio que la origina, por eso
 * un fallo al registrar se reporta en el log sin propagar la excepción.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId === undefined || entry.entityId === null ? null : String(entry.entityId),
          reason: entry.reason ?? null,
        },
      });
    } catch (error: any) {
      this.logger.error(
        `No se pudo registrar la auditoría '${entry.action}' sobre ${entry.entity}#${entry.entityId}: ${error?.message}`,
      );
    }
  }

  /** Varias entradas en una sola transacción (por ejemplo, un lote de reimpresiones). */
  async logMany(entries: AuditEntry[]): Promise<void> {
    if (entries.length === 0) return;
    try {
      await this.prisma.auditLog.createMany({
        data: entries.map((entry) => ({
          userId: entry.userId ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId === undefined || entry.entityId === null ? null : String(entry.entityId),
          reason: entry.reason ?? null,
        })),
      });
    } catch (error: any) {
      this.logger.error(`No se pudo registrar el lote de auditoría (${entries.length} entradas): ${error?.message}`);
    }
  }

  /** Consulta de eventos auditados con filtros (TASK-4.3, pantalla de auditoría). */
  async findAll(query: QueryAuditDto): Promise<AuditListResult> {
    const { page, limit, skip, take } = resolvePagination(query.page, query.limit);
    const and: Prisma.AuditLogWhereInput[] = [];

    if (query.action) and.push({ action: query.action });
    if (query.userId) and.push({ userId: query.userId });
    if (query.entity) and.push({ entity: query.entity });
    if (query.entityId) and.push({ entityId: query.entityId });

    if (query.search?.trim()) {
      const search = query.search.trim();
      and.push({
        OR: [
          { reason: { contains: search, mode: 'insensitive' } },
          { action: { contains: search, mode: 'insensitive' } },
          { entityId: { contains: search } },
        ],
      });
    }

    if (query.from) and.push({ createdAt: { gte: parseInstant(`${query.from}T00:00:00`) } });
    if (query.to) and.push({ createdAt: { lte: parseInstant(`${query.to}T23:59:59.999`) } });

    const where: Prisma.AuditLogWhereInput = and.length > 0 ? { AND: and } : {};

    const [rows, total, actionCounts, actorCounts] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        select: AUDIT_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.groupBy({ by: ['action'], _count: { _all: true } }),
      this.prisma.auditLog.groupBy({ by: ['userId'], _count: { _all: true } }),
    ]);

    const actorIds = actorCounts
      .map((actor) => actor.userId)
      .filter((id): id is number => id !== null);

    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, fullName: true, username: true, role: true },
        })
      : [];

    return {
      data: rows.map(toView),
      meta: {
        ...paginate([], total, page, limit).meta,
        filters: {
          actions: actionCounts
            .map((entry) => ({
              action: entry.action,
              label: auditActionLabel(entry.action),
              count: entry._count._all,
            }))
            .sort((a, b) => b.count - a.count),
          users: actors
            .map((actor) => ({
              id: actor.id,
              fullName: actor.fullName,
              username: actor.username,
              role: actor.role,
            }))
            .sort((a, b) => a.fullName.localeCompare(b.fullName)),
        },
      },
    };
  }
}
