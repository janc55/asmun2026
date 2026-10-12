import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CheckpointType, ParticipantRole } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
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

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIMEZONE_HINT =
  'Envíe un instante ISO 8601 con desplazamiento, por ejemplo 2026-10-23T12:00:00-04:00';

export class CreateCheckpointDto {
  @ApiProperty({ description: 'Nombre visible del punto', example: 'Almuerzo día 1' })
  @IsString({ message: 'name debe ser texto' })
  @MinLength(2, { message: 'name debe tener al menos 2 caracteres' })
  @MaxLength(120, { message: 'name no puede superar 120 caracteres' })
  name: string;

  @ApiProperty({ enum: CheckpointType, description: 'Tipo del punto de control' })
  @IsEnum(CheckpointType, {
    message: `type debe ser uno de: ${Object.values(CheckpointType).join(', ')}`,
  })
  type: CheckpointType;

  @ApiProperty({ description: 'Día del evento (YYYY-MM-DD)', example: '2026-10-23' })
  @IsString({ message: 'day debe ser texto' })
  @Matches(DAY_PATTERN, { message: 'day debe tener el formato YYYY-MM-DD' })
  day: string;

  @ApiPropertyOptional({ description: `Inicio de la ventana horaria. ${TIMEZONE_HINT}` })
  @IsOptional()
  @IsString()
  startsAt?: string | null;

  @ApiPropertyOptional({ description: `Fin de la ventana horaria. ${TIMEZONE_HINT}` })
  @IsOptional()
  @IsString()
  endsAt?: string | null;

  @ApiPropertyOptional({ description: 'Punto que debe cumplirse antes (dependencia)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'requiresCheckpointId debe ser un número entero' })
  @Min(1)
  requiresCheckpointId?: number | null;

  @ApiPropertyOptional({
    enum: ParticipantRole,
    isArray: true,
    description: 'Roles habilitados; vacío u omitido = todos los roles',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ParticipantRole, {
    each: true,
    message: `appliesToRoles solo admite: ${Object.values(ParticipantRole).join(', ')}`,
  })
  appliesToRoles?: ParticipantRole[] | null;

  @ApiPropertyOptional({ description: 'Punto habilitado', default: true })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCheckpointDto extends PartialType(CreateCheckpointDto) {}

export class QueryCheckpointsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Búsqueda por nombre' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ description: 'Filtra por día (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  @Matches(DAY_PATTERN, { message: 'day debe tener el formato YYYY-MM-DD' })
  day?: string;

  @ApiPropertyOptional({ enum: CheckpointType })
  @IsOptional()
  @IsEnum(CheckpointType)
  type?: CheckpointType;

  @ApiPropertyOptional({ description: 'Filtra por estado habilitado/deshabilitado' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Solo los puntos abiertos en este momento' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  onlyOpen?: boolean;
}
