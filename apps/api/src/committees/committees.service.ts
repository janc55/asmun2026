import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginatedResult, resolvePagination } from '../common/dto/pagination.dto';
import { CreateCommitteeDto, QueryCommitteeDto, UpdateCommitteeDto } from './dto/committee.dto';

export interface CommitteeView {
  id: number;
  name: string;
  shortName: string | null;
  participantsCount: number;
}

const COMMITTEE_SELECT = {
  id: true,
  name: true,
  shortName: true,
  _count: { select: { participants: true } },
} satisfies Prisma.CommitteeSelect;

type CommitteeRow = Prisma.CommitteeGetPayload<{ select: typeof COMMITTEE_SELECT }>;

function toView(row: CommitteeRow): CommitteeView {
  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    participantsCount: row._count.participants,
  };
}

/** Comités / foros del evento (RF-03). */
@Injectable()
export class CommitteesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryCommitteeDto): Promise<PaginatedResult<CommitteeView>> {
    const { page, limit, skip, take } = resolvePagination(query.page, query.limit);
    const search = query.search?.trim();

    const where: Prisma.CommitteeWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { shortName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.committee.findMany({
        where,
        select: COMMITTEE_SELECT,
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      this.prisma.committee.count({ where }),
    ]);

    return paginate(rows.map(toView), total, page, limit);
  }

  async findOne(id: number): Promise<CommitteeView> {
    const row = await this.prisma.committee.findUnique({ where: { id }, select: COMMITTEE_SELECT });
    if (!row) {
      throw new NotFoundException({
        code: 'COMMITTEE_NOT_FOUND',
        message: `No existe un comité con id ${id}`,
      });
    }
    return toView(row);
  }

  async create(dto: CreateCommitteeDto): Promise<CommitteeView> {
    const name = dto.name.trim();
    await this.assertNameAvailable(name);

    const row = await this.prisma.committee.create({
      data: { name, shortName: dto.shortName?.trim() || null },
      select: COMMITTEE_SELECT,
    });
    return toView(row);
  }

  async update(id: number, dto: UpdateCommitteeDto): Promise<CommitteeView> {
    await this.findOne(id);

    const data: Prisma.CommitteeUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      await this.assertNameAvailable(name, id);
      data.name = name;
    }
    if (dto.shortName !== undefined) {
      data.shortName = dto.shortName?.trim() || null;
    }

    const row = await this.prisma.committee.update({ where: { id }, data, select: COMMITTEE_SELECT });
    return toView(row);
  }

  /** Igual que en colegios: no se elimina un comité con participantes asignados. */
  async remove(id: number): Promise<{ id: number; deleted: true }> {
    const committee = await this.prisma.committee.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { participants: true } } },
    });

    if (!committee) {
      throw new NotFoundException({
        code: 'COMMITTEE_NOT_FOUND',
        message: `No existe un comité con id ${id}`,
      });
    }

    if (committee._count.participants > 0) {
      throw new ConflictException({
        code: 'COMMITTEE_IN_USE',
        message: `No se puede eliminar '${committee.name}': tiene ${committee._count.participants} participante(s) asignado(s).`,
      });
    }

    await this.prisma.committee.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Resuelve un comité por nombre o sigla para la importación masiva. */
  async ensureByName(
    name: string,
    shortName?: string | null,
  ): Promise<{ id: number; created: boolean }> {
    const cleanName = name.trim();
    const cleanShort = shortName?.trim() || null;

    const orConditions: Prisma.CommitteeWhereInput[] = [
      { name: { equals: cleanName, mode: 'insensitive' } },
    ];
    if (cleanShort) {
      orConditions.push({ shortName: { equals: cleanShort, mode: 'insensitive' } });
    }

    const existing = await this.prisma.committee.findFirst({
      where: { OR: orConditions },
      select: { id: true },
    });
    if (existing) return { id: existing.id, created: false };

    const created = await this.prisma.committee.create({
      data: { name: cleanName, shortName: cleanShort },
      select: { id: true },
    });
    return { id: created.id, created: true };
  }

  private async assertNameAvailable(name: string, excludeId?: number): Promise<void> {
    const existing = await this.prisma.committee.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException({
        code: 'COMMITTEE_EXISTS',
        message: `Ya existe un comité con el nombre '${name}'`,
      });
    }
  }
}
