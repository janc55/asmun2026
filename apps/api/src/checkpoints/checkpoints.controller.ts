import {
  Body,
  Controller,
  Delete,
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CheckpointsService } from './checkpoints.service';
import {
  CreateCheckpointDto,
  QueryCheckpointsDto,
  UpdateCheckpointDto,
} from './dto/checkpoint.dto';

@ApiTags('Puntos de control')
@ApiBearerAuth()
@Controller('checkpoints')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CheckpointsController {
  constructor(private readonly checkpointsService: CheckpointsService) {}

  @Get()
  @Roles(UserRole.admin, UserRole.lector)
  @ApiOperation({ summary: 'Lista puntos de control con filtros de día, tipo y estado' })
  findAll(@Query() query: QueryCheckpointsDto) {
    return this.checkpointsService.findAll(query);
  }

  @Get('available')
  @Roles(UserRole.admin, UserRole.registrador, UserRole.operador)
  @ApiOperation({
    summary: 'Puntos que el usuario autenticado puede operar, con su estado (abierto/cerrado)',
  })
  available(@CurrentUser() user: AuthUser) {
    return this.checkpointsService.findAvailableForUser(user);
  }

  @Get(':id')
  @Roles(UserRole.admin, UserRole.registrador, UserRole.lector)
  @ApiOperation({ summary: 'Detalle de un punto de control' })
  @ApiResponse({ status: 404, description: 'Punto de control no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.checkpointsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Crea un punto de control (RF-09)' })
  @ApiResponse({ status: 400, description: 'Ventana horaria o dependencia inválida' })
  create(@Body() dto: CreateCheckpointDto) {
    return this.checkpointsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Edita un punto de control, su horario o su dependencia' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCheckpointDto) {
    return this.checkpointsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Elimina un punto de control sin escaneos ni dependientes' })
  @ApiResponse({ status: 409, description: 'El punto tiene escaneos o puntos dependientes' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.checkpointsService.remove(id);
  }
}
