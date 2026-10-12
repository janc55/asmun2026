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
import { SchoolsService } from './schools.service';
import { CreateSchoolDto, QuerySchoolDto, UpdateSchoolDto } from './dto/school.dto';

@ApiTags('Colegios')
@ApiBearerAuth()
@Controller('schools')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Get()
  @Roles(UserRole.admin, UserRole.registrador, UserRole.lector)
  @ApiOperation({ summary: 'Lista colegios/delegaciones con búsqueda y paginación' })
  findAll(@Query() query: QuerySchoolDto) {
    return this.schoolsService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.admin, UserRole.registrador, UserRole.lector)
  @ApiOperation({ summary: 'Detalle de un colegio' })
  @ApiResponse({ status: 404, description: 'Colegio no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.schoolsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.admin, UserRole.registrador)
  @ApiOperation({ summary: 'Crea un colegio' })
  @ApiResponse({ status: 409, description: 'Nombre de colegio duplicado' })
  create(@Body() dto: CreateSchoolDto) {
    return this.schoolsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.admin, UserRole.registrador)
  @ApiOperation({ summary: 'Edita un colegio' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSchoolDto) {
    return this.schoolsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Elimina un colegio sin participantes asociados' })
  @ApiResponse({ status: 409, description: 'El colegio tiene participantes asociados' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.schoolsService.remove(id);
  }
}
