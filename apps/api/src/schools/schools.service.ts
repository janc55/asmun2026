import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginatedResult, resolvePagination } from '../common/dto/pagination.dto';
import { CreateSchoolDto, QuerySchoolDto, UpdateSchoolDto } from './dto/school.dto';

export interface SchoolView {
  id: number;
  name: string;
  city: string | null;
  participantsCount: number;
}

const SCHOOL_SELECT = {
  id: true,
  name: true,
  city: true,
  _count: { select: { participants: true } },
} satisfies Prisma.SchoolSelect;

type SchoolRow = Prisma.SchoolGetPayload<{ select: typeof SCHOOL_SELECT }>;

function toView(row: SchoolRow): SchoolView {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    participantsCount: row._count.participants,
  };
}

/** Colegios / delegaciones participantes (RF-03). */
@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QuerySchoolDto): Promise<PaginatedResult<SchoolView>> {
    const { page, limit, skip, take } = resolvePagination(query.page, query.limit);
    const search = query.search?.trim();

    const where: Prisma.SchoolWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.school.findMany({
        where,
        select: SCHOOL_SELECT,
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      this.prisma.school.count({ where }),
    ]);

    return paginate(rows.map(toView), total, page, limit);
  }

  async findOne(id: number): Promise<SchoolView> {
    const row = await this.prisma.school.findUnique({ where: { id }, select: SCHOOL_SELECT });
    if (!row) {
      throw new NotFoundException({
        code: 'SCHOOL_NOT_FOUND',
        message: `No existe un colegio con id ${id}`,
      });
    }
    return toView(row);
  }

  async create(dto: CreateSchoolDto): Promise<SchoolView> {
    const name = dto.name.trim();
    await this.assertNameAvailable(name);

    const row = await this.prisma.school.create({
      data: { name, city: dto.city?.trim() || null },
      select: SCHOOL_SELECT,
    });
    return toView(row);
  }

  async update(id: number, dto: UpdateSchoolDto): Promise<SchoolView> {
    await this.findOne(id);

    const data: Prisma.SchoolUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      await this.assertNameAvailable(name, id);
      data.name = name;
    }
    if (dto.city !== undefined) {
      data.city = dto.city?.trim() || null;
    }

    const row = await this.prisma.school.update({ where: { id }, data, select: SCHOOL_SELECT });
    return toView(row);
  }

  /**
   * Elimina un colegio solo si no tiene participantes asociados. Borrarlo con
   * participantes dejaría credenciales sin delegación, así que se rechaza con un
   * mensaje claro en lugar de perder el dato en silencio.
   */
  async remove(id: number): Promise<{ id: number; deleted: true }> {
    const school = await this.prisma.school.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { participants: true } } },
    });

    if (!school) {
      throw new NotFoundException({
        code: 'SCHOOL_NOT_FOUND',
        message: `No existe un colegio con id ${id}`,
      });
    }

    if (school._count.participants > 0) {
      throw new ConflictException({
        code: 'SCHOOL_IN_USE',
        message: `No se puede eliminar '${school.name}': tiene ${school._count.participants} participante(s) asociado(s).`,
      });
    }

    await this.prisma.school.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * Resuelve un colegio por nombre para la importación masiva, creándolo si no
   * existe. Devuelve el `id` y si la fila creó un colegio nuevo.
   */
  async ensureByName(name: string, city?: string | null): Promise<{ id: number; created: boolean }> {
    const cleanName = name.trim();
    const existing = await this.prisma.school.findFirst({
      where: { name: { equals: cleanName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) return { id: existing.id, created: false };

    const created = await this.prisma.school.create({
      data: { name: cleanName, city: city?.trim() || null },
      select: { id: true },
    });
    return { id: created.id, created: true };
  }

  private async assertNameAvailable(name: string, excludeId?: number): Promise<void> {
    const existing = await this.prisma.school.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException({
        code: 'SCHOOL_EXISTS',
        message: `Ya existe un colegio con el nombre '${name}'`,
      });
    }
  }
}
