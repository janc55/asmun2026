import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { ParticipantsService } from '../participants/participants.service';
import { BadgePdfService, EventInfo } from './badge-pdf.service';
import { BadgeBatchDto, BadgeFormat } from './dto/badge.dto';

export interface BadgeRenderResult {
  buffer: Buffer;
  filename: string;
  count: number;
}

const DEFAULT_REPRINT_REASON = 'Reimpresión de credencial solicitada en acreditación';

@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly participantsService: ParticipantsService,
    private readonly badgePdf: BadgePdfService,
    private readonly audit: AuditService,
  ) {}

  /** Credencial individual (SDD 12.2: `GET /badges/{participant_id}.pdf`). */
  async renderIndividual(
    id: number,
    options: { format: BadgeFormat; reprint: boolean; reason?: string; userId: number },
  ): Promise<BadgeRenderResult> {
    const [participant] = await this.participantsService.resolveForBadges({ ids: [id] });

    if (!participant) {
      throw new NotFoundException({
        code: 'PARTICIPANT_NOT_FOUND',
        message: `No existe un participante con id ${id}`,
      });
    }

    const buffer = await this.badgePdf.render([participant], {
      sheet: options.format ?? 'card',
      event: this.eventInfo(),
    });

    // RF-08: la reimpresión conserva el mismo código y queda registrada.
    if (options.reprint) {
      await this.audit.log({
        userId: options.userId,
        action: 'reimpresion',
        entity: 'participant',
        entityId: participant.id,
        reason: options.reason?.trim() || DEFAULT_REPRINT_REASON,
      });
    }

    return {
      buffer,
      filename: `credencial-${participant.code}.pdf`,
      count: 1,
    };
  }

  /** Credenciales por lote: ids explícitos o filtros (RF-06). */
  async renderBatch(dto: BadgeBatchDto, userId: number): Promise<BadgeRenderResult> {
    const participants = await this.participantsService.resolveForBadges({
      ids: dto.participantIds,
      search: dto.search,
      schoolId: dto.schoolId,
      committeeId: dto.committeeId,
      role: dto.role,
      isActive: dto.isActive,
    });

    if (participants.length === 0) {
      throw new NotFoundException({
        code: 'NO_PARTICIPANTS',
        message: 'No se encontraron participantes para los filtros indicados.',
      });
    }

    const buffer = await this.badgePdf.render(participants, {
      sheet: dto.format ?? 'a4',
      event: this.eventInfo(),
    });

    if (dto.reprint) {
      await this.audit.logMany(
        participants.map((participant) => ({
          userId,
          action: 'reimpresion',
          entity: 'participant',
          entityId: participant.id,
          reason: dto.reason?.trim() || DEFAULT_REPRINT_REASON,
        })),
      );
      this.logger.log(`Reimpresión de ${participants.length} credencial(es) registrada en auditoría.`);
    }

    return {
      buffer,
      filename: `credenciales-asmun-${participants.length}.pdf`,
      count: participants.length,
    };
  }

  private eventInfo(): EventInfo {
    return {
      name: this.configService.get<string>('EVENT_NAME', 'ASMUN 2026'),
      subtitle: this.configService.get<string>('EVENT_SUBTITLE', 'Colegio Americano de Oruro'),
    };
  }
}
