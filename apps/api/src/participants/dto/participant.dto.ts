import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { ParticipantRole } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { toBoolean } from '../../common/utils/http-transform.util';

export class CreateParticipantDto {
  @ApiProperty({ description: 'Nombres del participante', example: 'Ana María' })
  @IsString({ message: 'firstName debe ser texto' })
  @MinLength(1, { message: 'firstName es obligatorio' })
  @MaxLength(100, { message: 'firstName no puede superar 100 caracteres' })
  firstName: string;

  @ApiProperty({ description: 'Apellidos del participante', example: 'Quispe Mamani' })
  @IsString({ message: 'lastName debe ser texto' })
  @MinLength(1, { message: 'lastName es obligatorio' })
  @MaxLength(100, { message: 'lastName no puede superar 100 caracteres' })
  lastName: string;

  @ApiProperty({ enum: ParticipantRole, description: 'Rol del participante' })
  @IsEnum(ParticipantRole, {
    message: `role debe ser uno de: ${Object.values(ParticipantRole).join(', ')}`,
  })
  role: ParticipantRole;

  @ApiPropertyOptional({ description: 'Documento de identidad (opcional, no se imprime)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentId?: string;

  @ApiPropertyOptional({ description: 'Cargo (solo quienes lo tienen)', example: 'Presidente' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  position?: string;

  @ApiPropertyOptional({ description: 'ID del colegio/delegación' })
  @IsOptional()
  @IsInt()
  @Min(1)
  schoolId?: number | null;

  @ApiPropertyOptional({ description: 'ID del comité/foro' })
  @IsOptional()
  @IsInt()
  @Min(1)
  committeeId?: number | null;

  @ApiPropertyOptional({ description: 'País que representa', example: 'Brasil' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({ description: 'Alergias o restricciones alimentarias (no se imprime)' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  dietaryNotes?: string;

  @ApiPropertyOptional({ description: 'Observaciones internas' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Código corto manual (se genera automáticamente si se omite)',
    example: 'K7P3Q9',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  code?: string;

  @ApiPropertyOptional({ description: 'Participante habilitado', default: true })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}

/** El código corto no se edita: ya está impreso en la credencial (RF-08). */
export class UpdateParticipantDto extends PartialType(
  OmitType(CreateParticipantDto, ['code'] as const),
) {}

export class QueryParticipantsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Búsqueda por nombre, apellido, código o documento' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: ParticipantRole })
  @IsOptional()
  @IsEnum(ParticipantRole, {
    message: `role debe ser uno de: ${Object.values(ParticipantRole).join(', ')}`,
  })
  role?: ParticipantRole;

  @ApiPropertyOptional({ description: 'Filtra por colegio (id)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  schoolId?: number;

  @ApiPropertyOptional({ description: 'Alias de schoolId' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  school?: number;

  @ApiPropertyOptional({ description: 'Filtra por comité (id)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  committeeId?: number;

  @ApiPropertyOptional({ description: 'Alias de committeeId' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  committee?: number;

  @ApiPropertyOptional({ description: 'Filtra por estado (true = activos, false = desactivados)' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}
