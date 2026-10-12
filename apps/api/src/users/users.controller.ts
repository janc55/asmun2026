import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';
import { AssignCheckpointsDto, CreateUserDto, QueryUsersDto, UpdateUserDto } from './dto/user.dto';

@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista usuarios con sus puntos asignados' })
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un usuario' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un usuario (admin, registrador, operador o lector)' })
  @ApiResponse({ status: 409, description: 'Nombre de usuario ya en uso' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita nombre, rol, contraseña o estado del usuario' })
  @ApiResponse({ status: 409, description: 'Debe quedar al menos un administrador activo' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Put(':id/checkpoints')
  @ApiOperation({
    summary: 'Reemplaza los puntos de control asignados al usuario (TASK-3.1)',
  })
  @ApiResponse({ status: 400, description: 'Algún punto de control no existe' })
  assignCheckpoints(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignCheckpointsDto) {
    return this.usersService.assignCheckpoints(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina un usuario sin escaneos ni registros de auditoría' })
  @ApiResponse({ status: 409, description: 'El usuario tiene escaneos o auditoría' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
