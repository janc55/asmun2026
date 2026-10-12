import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ScansService } from './scans.service';
import {
  CreateScanDto,
  OverrideScanDto,
  QueryScansDto,
  SearchParticipantsDto,
  VoidScanDto,
} from './dto/scan.dto';

@ApiTags('Escaneos')
@ApiBearerAuth()
@Controller('scans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.admin, UserRole.registrador, UserRole.operador)
  @ApiOperation({
    summary:
      'Registra un escaneo (QR, código corto o búsqueda) y devuelve el resultado del semáforo: ok, duplicado, fuera_de_horario, falta_requisito, no_habilitado o no_encontrado',
  })
  @ApiResponse({ status: 200, description: 'Resultado del control (todo intento queda registrado)' })
  @ApiResponse({ status: 403, description: 'El punto no está asignado al operador' })
  @ApiResponse({ status: 404, description: 'Punto de control inexistente' })
  register(@Body() dto: CreateScanDto, @CurrentUser() user: AuthUser) {
    return this.scansService.register(dto, user);
  }

  @Get()
  @Roles(UserRole.admin, UserRole.lector)
  @ApiOperation({
    summary: 'Historial de escaneos con filtros (incluye intentos rechazados y anulados)',
  })
  findAll(@Query() query: QueryScansDto) {
    return this.scansService.findAllScans(query);
  }

  @Get('search')
  @Roles(UserRole.admin, UserRole.registrador, UserRole.operador)
  @ApiOperation({ summary: 'Busca participantes por nombre o código para el registro manual (SDD 8.4)' })
  search(@Query() dto: SearchParticipantsDto, @CurrentUser() user: AuthUser) {
    return this.scansService.searchParticipants(dto, user);
  }

  @Post('override')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.admin)
  @ApiOperation({
    summary: 'Autoriza una excepción con motivo obligatorio y la registra en auditoría (RF-14)',
  })
  @ApiResponse({ status: 200, description: 'Excepción registrada' })
  override(@Body() dto: OverrideScanDto, @CurrentUser() user: AuthUser) {
    return this.scansService.override(dto, user);
  }

  @Post(':id/void')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.admin)
  @ApiOperation({
    summary: 'Anula un escaneo registrado por error (RF-15), liberando el punto para esa persona',
  })
  @ApiResponse({ status: 200, description: 'Escaneo anulado' })
  @ApiResponse({ status: 409, description: 'El escaneo ya estaba anulado o no era válido' })
  voidScan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidScanDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.scansService.void(id, dto, user);
  }
}
