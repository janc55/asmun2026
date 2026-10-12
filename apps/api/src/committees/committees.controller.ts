import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { CommitteesService } from './committees.service';
import { CreateCommitteeDto, QueryCommitteeDto, UpdateCommitteeDto } from './dto/committee.dto';

@ApiTags('Comités')
@ApiBearerAuth()
@Controller('committees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommitteesController {
  constructor(private readonly committeesService: CommitteesService) {}

  @Get()
  @Roles(UserRole.admin, UserRole.registrador, UserRole.lector)
  @ApiOperation({ summary: 'Lista comités/foros con búsqueda y paginación' })
  findAll(@Query() query: QueryCommitteeDto) {
    return this.committeesService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.admin, UserRole.registrador, UserRole.lector)
  @ApiOperation({ summary: 'Detalle de un comité' })
  @ApiResponse({ status: 404, description: 'Comité no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.committeesService.findOne(id);
  }

  @Post()
  @Roles(UserRole.admin, UserRole.registrador)
  @ApiOperation({ summary: 'Crea un comité' })
  @ApiResponse({ status: 409, description: 'Nombre de comité duplicado' })
  create(@Body() dto: CreateCommitteeDto) {
    return this.committeesService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.admin, UserRole.registrador)
  @ApiOperation({ summary: 'Edita un comité' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCommitteeDto) {
    return this.committeesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Elimina un comité sin participantes asignados' })
  @ApiResponse({ status: 409, description: 'El comité tiene participantes asignados' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.committeesService.remove(id);
  }
}
