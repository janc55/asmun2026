import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginatedResult, resolvePagination } from '../common/dto/pagination.dto';
import { formatDayLabel } from '../common/utils/datetime.util';
import { AssignCheckpointsDto, CreateUserDto, QueryUsersDto, UpdateUserDto } from './dto/user.dto';

const BCRYPT_ROUNDS = 10;

const USER_SELECT = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  isActive: true,
  userCheckpoints: {
    select: {
      checkpoint: { select: { id: true, name: true, type: true, day: true } },
    },
    orderBy: { checkpointId: 'asc' },
  },
  _count: { select: { scans: true, auditLogs: true } },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

export interface UserView {
  id: number;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
  assignedCheckpoints: Array<{ id: number; name: string; type: string; day: string; dayLabel: string }>;
  checkpointIds: number[];
  scansCount: number;
}

function toView(row: UserRow): UserView {
  const assignedCheckpoints = row.userCheckpoints.map(({ checkpoint }) => {
    const day = checkpoint.day.toISOString().slice(0, 10);
    return {
      id: checkpoint.id,
      name: checkpoint.name,
      type: checkpoint.type,
      day,
      dayLabel: formatDayLabel(day),
    };
  });

  return {
    id: row.id,
    username: row.username,
    fullName: row.fullName,
    role: row.role,
    isActive: row.isActive,
    assignedCheckpoints,
    checkpointIds: assignedCheckpoints.map((checkpoint) => checkpoint.id),
    scansCount: row._count.scans,
  };
}

/** Usuarios del sistema y asignación de puntos a los operadores (SDD 2 y 13). */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryUsersDto): Promise<PaginatedResult<UserView>> {
    const { page, limit, skip, take } = resolvePagination(query.page, query.limit);
    const and: Prisma.UserWhereInput[] = [];

    if (query.search?.trim()) {
      const search = query.search.trim();
      and.push({
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { fullName: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (query.role) and.push({ role: query.role });
    if (query.isActive !== undefined && query.isActive !== null) and.push({ isActive: query.isActive });
    if (query.checkpointId) {
      and.push({ userCheckpoints: { some: { checkpointId: query.checkpointId } } });
    }

    const where: Prisma.UserWhereInput = and.length > 0 ? { AND: and } : {};

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, select: USER_SELECT, orderBy: { username: 'asc' }, skip, take }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(rows.map(toView), total, page, limit);
  }

  async findById(id: number): Promise<UserView> {
    const row = await this.findRow(id);
    return toView(row);
  }

  async create(dto: CreateUserDto): Promise<UserView> {
    const username = dto.username.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (existing) {
      throw new ConflictException({
        code: 'USERNAME_EXISTS',
        message: `El nombre de usuario '${username}' ya está en uso`,
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        username,
        fullName: dto.fullName.trim(),
        passwordHash,
        role: dto.role,
      },
      select: { id: true },
    });

    if (dto.checkpointIds && dto.checkpointIds.length > 0) {
      await this.assignCheckpoints(user.id, { checkpointIds: dto.checkpointIds });
    }

    return this.findById(user.id);
  }

  async update(id: number, dto: UpdateUserDto): Promise<UserView> {
    const current = await this.findRow(id);

    const data: Prisma.UserUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password !== undefined) data.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Evita dejar el sistema sin ningún administrador activo.
    const losesAdmin =
      current.role === UserRole.admin &&
      ((dto.role !== undefined && dto.role !== UserRole.admin) || dto.isActive === false);
    if (losesAdmin) {
      await this.assertNotLastAdmin(id);
    }

    const row = await this.prisma.user.update({ where: { id }, data, select: USER_SELECT });
    return toView(row);
  }

  /** Reemplaza la asignación de puntos del usuario (TASK-3.1). */
  async assignCheckpoints(userId: number, dto: AssignCheckpointsDto): Promise<UserView> {
    await this.findRow(userId);

    const uniqueIds = Array.from(new Set(dto.checkpointIds ?? []));

    if (uniqueIds.length > 0) {
      const found = await this.prisma.checkpoint.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
      });

      if (found.length !== uniqueIds.length) {
        const missing = uniqueIds.filter((id) => !found.some((checkpoint) => checkpoint.id === id));
        throw new BadRequestException({
          code: 'CHECKPOINT_NOT_FOUND',
          message: `No existe(n) el/los punto(s) de control: ${missing.join(', ')}`,
        });
      }
    }

    await this.prisma.$transaction([
      this.prisma.userCheckpoint.deleteMany({ where: { userId } }),
      ...(uniqueIds.length > 0
        ? [
            this.prisma.userCheckpoint.createMany({
              data: uniqueIds.map((checkpointId) => ({ userId, checkpointId })),
            }),
          ]
        : []),
    ]);

    return this.findById(userId);
  }

  async remove(id: number): Promise<{ id: number; deleted: true }> {
    const row = await this.findRow(id);

    // El historial no se borra (RNF-05): se conserva quién registró cada escaneo.
    if (row._count.scans > 0) {
      throw new ConflictException({
        code: 'USER_HAS_SCANS',
        message: `No se puede eliminar '${row.username}': tiene ${row._count.scans} escaneo(s) registrado(s). Desactívelo en su lugar.`,
      });
    }

    if (row._count.auditLogs > 0) {
      throw new ConflictException({
        code: 'USER_HAS_AUDIT',
        message: `No se puede eliminar '${row.username}': aparece en ${row._count.auditLogs} registro(s) de auditoría. Desactívelo en su lugar.`,
      });
    }

    if (row.role === UserRole.admin && row.isActive) {
      await this.assertNotLastAdmin(id);
    }

    await this.prisma.user.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async findRow(id: number): Promise<UserRow> {
    const row = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });

    if (!row) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: `Usuario con id ${id} no encontrado`,
      });
    }

    return row;
  }

  private async assertNotLastAdmin(excludedId: number): Promise<void> {
    const remaining = await this.prisma.user.count({
      where: { role: UserRole.admin, isActive: true, id: { not: excludedId } },
    });

    if (remaining === 0) {
      throw new ConflictException({
        code: 'LAST_ADMIN',
        message: 'Debe quedar al menos un administrador activo en el sistema.',
      });
    }
  }
}
