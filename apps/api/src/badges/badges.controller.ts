import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BadgesService, BadgeRenderResult } from './badges.service';
import { BadgeBatchDto, BadgeSingleQueryDto } from './dto/badge.dto';

const PDF_MIME = 'application/pdf';

@ApiTags('Credenciales')
@ApiBearerAuth()
@Controller('badges')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  @Get(':file')
  @Roles(UserRole.admin, UserRole.registrador)
  @ApiOperation({ summary: 'Credencial en PDF de un participante (`/badges/{id}.pdf`)' })
  @ApiResponse({ status: 200, description: 'PDF de la credencial' })
  @ApiResponse({ status: 404, description: 'Participante no encontrado' })
  async individual(
    @Param('file') file: string,
    @Query() query: BadgeSingleQueryDto,
    @CurrentUser('id') userId: number,
  ): Promise<StreamableFile> {
    const id = this.parseParticipantId(file);

    const result = await this.badgesService.renderIndividual(id, {
      format: query.format ?? 'card',
      reprint: query.reprint === true,
      reason: query.reason,
      userId,
    });

    return this.asFile(result, query.disposition ?? 'inline');
  }

  @Post('pdf')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.admin, UserRole.registrador)
  @ApiOperation({ summary: 'PDF masivo por lista de ids o por filtros (4 credenciales por hoja A4)' })
  @ApiResponse({ status: 200, description: 'PDF con las credenciales' })
  @ApiResponse({ status: 404, description: 'Sin participantes para los filtros indicados' })
  async batch(@Body() dto: BadgeBatchDto, @CurrentUser('id') userId: number): Promise<StreamableFile> {
    const result = await this.badgesService.renderBatch(dto, userId);
    return this.asFile(result, 'attachment');
  }

  @Post('reprint')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.admin, UserRole.registrador)
  @ApiOperation({
    summary: 'Reimpresión de credenciales manteniendo el código corto, con registro en auditoría (RF-08)',
  })
  @ApiResponse({ status: 200, description: 'PDF de las credenciales reimpresas' })
  async reprint(@Body() dto: BadgeBatchDto, @CurrentUser('id') userId: number): Promise<StreamableFile> {
    const result = await this.badgesService.renderBatch({ ...dto, reprint: true }, userId);
    return this.asFile(result, 'attachment');
  }

  private asFile(result: BadgeRenderResult, disposition: 'inline' | 'attachment'): StreamableFile {
    return new StreamableFile(result.buffer, {
      type: PDF_MIME,
      disposition: `${disposition}; filename="${result.filename}"`,
      length: result.buffer.length,
    });
  }

  /** Acepta `/badges/12.pdf` (SDD 12.2) y también `/badges/12`. */
  private parseParticipantId(file: string): number {
    const raw = String(file ?? '').replace(/\.pdf$/i, '');
    const id = Number(raw);

    if (!Number.isInteger(id) || id <= 0) {
      throw new NotFoundException({
        code: 'BADGE_NOT_FOUND',
        message: `Credencial no encontrada para '${file}'. Use /badges/{id}.pdf.`,
      });
    }

    return id;
  }
}
