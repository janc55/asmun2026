import { Controller, Get, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import {
  ReportParticipantsQueryDto,
  ReportPendingQueryDto,
  ReportScansQueryDto,
} from './dto/reports.dto';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('Reportes')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('participants.xlsx')
  @Roles(UserRole.admin, UserRole.lector)
  @ApiProduces(XLSX_MIME)
  @ApiOperation({ summary: 'Exporta los participantes a Excel con los filtros aplicados (RF-18)' })
  async participants(
    @Query() query: ReportParticipantsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.reportsService.participants(query);
    return this.asFile(file, response);
  }

  @Get('scans.xlsx')
  @Roles(UserRole.admin, UserRole.lector)
  @ApiProduces(XLSX_MIME)
  @ApiOperation({
    summary: 'Exporta el historial cronológico de escaneos, incluidos los intentos rechazados (RF-18)',
  })
  async scans(
    @Query() query: ReportScansQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.reportsService.scans(query);
    return this.asFile(file, response);
  }

  @Get('pending.xlsx')
  @Roles(UserRole.admin, UserRole.lector)
  @ApiProduces(XLSX_MIME)
  @ApiOperation({
    summary: 'Exporta los pendientes de un punto de control (catering: quiénes faltan)',
  })
  async pending(
    @Query() query: ReportPendingQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.reportsService.pending(query);
    return this.asFile(file, response);
  }

  private asFile(
    file: { buffer: Buffer; filename: string; rowCount: number },
    response: Response,
  ): StreamableFile {
    // El conteo viaja al cliente para mostrar "N filas exportadas".
    response.setHeader('X-Row-Count', String(file.rowCount));

    return new StreamableFile(file.buffer, {
      type: XLSX_MIME,
      disposition: `attachment; filename="${file.filename}"`,
      length: file.buffer.length,
    });
  }
}
