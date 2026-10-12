import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ParticipantsService } from './participants.service';
import {
  CreateParticipantDto,
  QueryParticipantsDto,
  UpdateParticipantDto,
} from './dto/participant.dto';

@ApiTags('Participantes')
@ApiBearerAuth()
@Controller('participants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Get()
  @Roles(UserRole.admin, UserRole.registrador, UserRole.lector)
  @ApiOperation({
    summary: 'Lista participantes con filtros (search, school, role, committee) y paginación',
  })
  findAll(@Query() query: QueryParticipantsDto) {
    return this.participantsService.findAll(query);
  }

  @Get('by-code/:code')
  @Roles(UserRole.admin, UserRole.registrador, UserRole.lector)
  @ApiOperation({ summary: 'Resuelve un participante por código corto (insensible a mayúsculas y guiones)' })
  @ApiResponse({ status: 404, description: 'Código no encontrado o inválido' })
  findByCode(@Param('code') code: string) {
    return this.participantsService.findByCode(code);
  }

  @Get(':id')
  @Roles(UserRole.admin, UserRole.registrador, UserRole.lector)
  @ApiOperation({ summary: 'Detalle del participante e historial de escaneos' })
  @ApiResponse({ status: 404, description: 'Participante no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.participantsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.admin, UserRole.registrador)
  @ApiOperation({ summary: 'Crea un participante y genera su código corto único (RF-05)' })
  @ApiResponse({ status: 409, description: 'Código corto duplicado' })
  create(@Body() dto: CreateParticipantDto) {
    return this.participantsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.admin, UserRole.registrador)
  @ApiOperation({ summary: 'Edita los datos del participante o lo desactiva (isActive = false)' })
  @ApiResponse({ status: 404, description: 'Participante no encontrado' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateParticipantDto) {
    return this.participantsService.update(id, dto);
  }
}
