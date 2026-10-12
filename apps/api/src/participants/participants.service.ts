import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ParticipantRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginatedResult, resolvePagination } from '../common/dto/pagination.dto';
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  formatShortCode,
  isValidShortCode,
  normalizeShortCode,
  generateUniqueShortCode,
} from '../common/utils/code-generator.util';
import { CreateParticipantDto, QueryParticipantsDto, UpdateParticipantDto } from './dto/participant.dto';
import { buildParticipantSearchFilter } from '../common/utils/participant-search.util';

/** Datos que necesita la tabla de participantes y el motor de credenciales. */
export const PARTICIPANT_LIST_SELECT = {
  id: true,
  code: true,
  firstName: true,
  lastName: true,
  documentId: true,
  role: true,
  position: true,
  country: true,
  dietaryNotes: true,
  notes: true,
  isActive: true,
  createdAt: true,
  school: { select: { id: true, name: true, city: true } },
  committee: { select: { id: true, name: true, shortName: true } },
} satisfies Prisma.ParticipantSelect;

/** Historial de escaneos que acompaña al detalle (RF-16, sección 12.2). */
export const PARTICIPANT_DETAIL_SELECT = {
  ...PARTICIPANT_LIST_SELECT,
  scans: {
    select: {
      id: true,
      result: true,
      source: true,
      scannedAt: true,
      note: true,
      checkpoint: { select: { id: true, name: true, type: true, day: true } },
      user: { select: { id: true, fullName: true } },
    },
    orderBy: { scannedAt: 'desc' },
    take: 50,
  },
} satisfies Prisma.ParticipantSelect;

export type ParticipantView = Prisma.ParticipantGetPayload<{ select: typeof PARTICIPANT_LIST_SELECT }>;
export type ParticipantDetail = Prisma.ParticipantGetPayload<{ select: typeof PARTICIPANT_DETAIL_SELECT }>;

const MAX_CODE_ATTEMPTS = 5;

@Injectable()
export class ParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryParticipantsDto): Promise<PaginatedResult<ParticipantView>> {
    const { page, limit, skip, take } = resolvePagination(query.page, query.limit);
    const where = this.buildWhere(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.participant.findMany({
        where,
        select: PARTICIPANT_LIST_SELECT,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take,
      }),
      this.prisma.participant.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: number): Promise<ParticipantDetail> {
    const participant = await this.prisma.participant.findUnique({
      where: { id },
      select: PARTICIPANT_DETAIL_SELECT,
    });

    if (!participant) {
      throw new NotFoundException({
        code: 'PARTICIPANT_NOT_FOUND',
        message: `No existe un participante con id ${id}`,
      });
    }

    return participant;
  }

  /**
   * Resolución por código corto, tolerante a minúsculas, guiones y espacios
   * (SDD 8.2). Devuelve también participantes desactivados: quien decide si el
   * código es utilizable es el motor de control, no este endpoint.
   */
  async findByCode(rawCode: string): Promise<ParticipantView> {
    const code = normalizeShortCode(rawCode);

    if (!isValidShortCode(code)) {
      throw new NotFoundException({
        code: 'PARTICIPANT_NOT_FOUND',
        message: `Código no encontrado. Verifique el código de ${CODE_LENGTH} caracteres e intente de nuevo.`,
      });
    }

    const participant = await this.prisma.participant.findUnique({
      where: { code },
      select: PARTICIPANT_LIST_SELECT,
    });

    if (!participant) {
      throw new NotFoundException({
        code: 'PARTICIPANT_NOT_FOUND',
        message: `Código ${formatShortCode(code)} no encontrado. Verifique o busque por nombre.`,
      });
    }

    return participant;
  }

  async create(dto: CreateParticipantDto): Promise<ParticipantView> {
    await this.assertReferences(dto.schoolId, dto.committeeId);
    const data = this.buildCreateData(dto);

    if (dto.code) {
      const code = normalizeShortCode(dto.code);
      if (!isValidShortCode(code)) {
        throw new BadRequestException({
          code: 'INVALID_CODE',
          message: `El código '${dto.code}' no es válido: debe tener ${CODE_LENGTH} caracteres del alfabeto ${CODE_ALPHABET}.`,
        });
      }

      const taken = await this.prisma.participant.findUnique({ where: { code }, select: { id: true } });
      if (taken) {
        throw new ConflictException({
          code: 'CODE_EXISTS',
          message: `El código ${formatShortCode(code)} ya está asignado a otro participante.`,
        });
      }

      try {
        return await this.prisma.participant.create({
          data: { ...data, code },
          select: PARTICIPANT_LIST_SELECT,
        });
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          throw new ConflictException({
            code: 'CODE_EXISTS',
            message: `El código ${formatShortCode(code)} ya está asignado a otro participante.`,
          });
        }
        throw error;
      }
    }

    // Generación automática: el código es único y se verifica contra la base y
    // contra la carrera de dos registros simultáneos (índice único participants_code_key).
    for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt += 1) {
      const code = await generateUniqueShortCode(async (candidate) => {
        const found = await this.prisma.participant.findUnique({
          where: { code: candidate },
          select: { id: true },
        });
        return Boolean(found);
      });

      try {
        return await this.prisma.participant.create({
          data: { ...data, code },
          select: PARTICIPANT_LIST_SELECT,
        });
      } catch (error) {
        if (this.isUniqueViolation(error)) continue;
        throw error;
      }
    }

    throw new ConflictException({
      code: 'CODE_GENERATION_FAILED',
      message: 'No fue posible asignar un código corto único. Intente nuevamente.',
    });
  }

  async update(id: number, dto: UpdateParticipantDto): Promise<ParticipantView> {
    await this.ensureExists(id);

    if (dto.schoolId !== undefined || dto.committeeId !== undefined) {
      await this.assertReferences(dto.schoolId, dto.committeeId);
    }

    const data: Prisma.ParticipantUpdateInput = {};

    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.documentId !== undefined) data.documentId = dto.documentId?.trim() || null;
    if (dto.position !== undefined) data.position = dto.position?.trim() || null;
    if (dto.country !== undefined) data.country = dto.country?.trim() || null;
    if (dto.dietaryNotes !== undefined) data.dietaryNotes = dto.dietaryNotes?.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (dto.schoolId !== undefined) {
      data.school = dto.schoolId === null ? { disconnect: true } : { connect: { id: dto.schoolId } };
    }
    if (dto.committeeId !== undefined) {
      data.committee = dto.committeeId === null ? { disconnect: true } : { connect: { id: dto.committeeId } };
    }

    return this.prisma.participant.update({ where: { id }, data, select: PARTICIPANT_LIST_SELECT });
  }

  /** Resuelve los participantes de un lote de ids o de un filtro, en orden alfabético. */
  async resolveForBadges(params: {
    ids?: number[];
    search?: string;
    schoolId?: number;
    committeeId?: number;
    role?: ParticipantRole;
    isActive?: boolean;
  }): Promise<ParticipantView[]> {
    // Un lote explícito de ids se imprime completo: la reimpresión de una
    // credencial perdida no debe depender de que el participante esté activo.
    if (params.ids && params.ids.length > 0) {
      const participants = await this.prisma.participant.findMany({
        where: { id: { in: params.ids } },
        select: PARTICIPANT_LIST_SELECT,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      return participants;
    }

    const where = this.buildWhere({
      search: params.search,
      schoolId: params.schoolId,
      committeeId: params.committeeId,
      role: params.role,
      // Por filtro, el valor por defecto es imprimir solo participantes vigentes.
      isActive: params.isActive === undefined ? true : params.isActive,
    });

    return this.prisma.participant.findMany({
      where,
      select: PARTICIPANT_LIST_SELECT,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  private buildWhere(query: QueryParticipantsDto | Record<string, any>): Prisma.ParticipantWhereInput {
    const and: Prisma.ParticipantWhereInput[] = [];

    const searchFilter = buildParticipantSearchFilter(query.search);
    if (searchFilter) and.push(searchFilter);

    const schoolId = query.schoolId ?? query.school;
    const committeeId = query.committeeId ?? query.committee;

    if (schoolId) and.push({ schoolId });
    if (committeeId) and.push({ committeeId });
    if (query.role) and.push({ role: query.role });
    if (query.isActive !== undefined && query.isActive !== null) and.push({ isActive: query.isActive });

    return and.length > 0 ? { AND: and } : {};
  }

  private buildCreateData(dto: CreateParticipantDto): Omit<Prisma.ParticipantUncheckedCreateInput, 'code'> {
    return {
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      role: dto.role,
      documentId: dto.documentId?.trim() || null,
      position: dto.position?.trim() || null,
      schoolId: dto.schoolId ?? null,
      committeeId: dto.committeeId ?? null,
      country: dto.country?.trim() || null,
      dietaryNotes: dto.dietaryNotes?.trim() || null,
      notes: dto.notes?.trim() || null,
      isActive: dto.isActive ?? true,
    };
  }

  private async ensureExists(id: number): Promise<void> {
    const exists = await this.prisma.participant.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException({
        code: 'PARTICIPANT_NOT_FOUND',
        message: `No existe un participante con id ${id}`,
      });
    }
  }

  private async assertReferences(schoolId?: number | null, committeeId?: number | null): Promise<void> {
    if (schoolId !== undefined && schoolId !== null) {
      const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
      if (!school) {
        throw new BadRequestException({
          code: 'SCHOOL_NOT_FOUND',
          message: `No existe un colegio con id ${schoolId}`,
        });
      }
    }

    if (committeeId !== undefined && committeeId !== null) {
      const committee = await this.prisma.committee.findUnique({
        where: { id: committeeId },
        select: { id: true },
      });
      if (!committee) {
        throw new BadRequestException({
          code: 'COMMITTEE_NOT_FOUND',
          message: `No existe un comité con id ${committeeId}`,
        });
      }
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
