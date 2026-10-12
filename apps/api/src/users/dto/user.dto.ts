import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { toBoolean } from '../../common/utils/http-transform.util';

export class CreateUserDto {
  @ApiProperty({ description: 'Usuario para iniciar sesión', example: 'operador1' })
  @IsString({ message: 'username debe ser texto' })
  @MinLength(3, { message: 'username debe tener al menos 3 caracteres' })
  @MaxLength(50, { message: 'username no puede superar 50 caracteres' })
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'username solo admite letras, números, punto, guion y guion bajo',
  })
  username: string;

  @ApiProperty({ description: 'Nombre completo de la persona', example: 'Luis Mamani' })
  @IsString({ message: 'fullName debe ser texto' })
  @MinLength(3, { message: 'fullName debe tener al menos 3 caracteres' })
  @MaxLength(120, { message: 'fullName no puede superar 120 caracteres' })
  fullName: string;

  @ApiProperty({ description: 'Contraseña (mínimo 8 caracteres)', example: 'Puerta2026!' })
  @IsString({ message: 'password debe ser texto' })
  @MinLength(8, { message: 'password debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'password no puede superar 72 caracteres' })
  password: string;

  @ApiProperty({ enum: UserRole, description: 'Rol del usuario' })
  @IsEnum(UserRole, { message: `role debe ser uno de: ${Object.values(UserRole).join(', ')}` })
  role: UserRole;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Puntos de control asignados (se usan para el rol operador)',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  checkpointIds?: number[];
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ description: 'Nueva contraseña (mínimo 8 caracteres)' })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'password debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'password no puede superar 72 caracteres' })
  password?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole, { message: `role debe ser uno de: ${Object.values(UserRole).join(', ')}` })
  role?: UserRole;

  @ApiPropertyOptional({ description: 'Usuario habilitado' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}

export class AssignCheckpointsDto {
  @ApiProperty({ type: [Number], description: 'Ids de los puntos asignados (reemplaza la asignación)' })
  @IsArray({ message: 'checkpointIds debe ser una lista' })
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true, message: 'checkpointIds solo admite ids numéricos' })
  checkpointIds: number[];
}

export class QueryUsersDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Búsqueda por usuario o nombre completo' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ description: 'Filtra por estado habilitado/deshabilitado' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Usuarios asignados a un punto de control' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  checkpointId?: number;
}
