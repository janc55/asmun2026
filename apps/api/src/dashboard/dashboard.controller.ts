import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { QueryDashboardDto, QueryPendingDto } from './dto/dashboard.dto';

@ApiTags('Panel')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(UserRole.admin, UserRole.lector)
  @ApiOperation({
    summary:
      'Cifras del evento: esperados vs. registrados por punto de control, porcentaje de avance y desglose por colegio y por tipo (RF-16)',
  })
  findAll(@Query() query: QueryDashboardDto) {
    return this.dashboardService.summary(query);
  }

  @Get('pending')
  @Roles(UserRole.admin, UserRole.lector)
  @ApiOperation({ summary: 'Participantes que aún no cumplen un punto de control (RF-17)' })
  @ApiResponse({ status: 404, description: 'Punto de control inexistente' })
  pending(@Query() query: QueryPendingDto) {
    return this.dashboardService.pending(query);
  }
}
