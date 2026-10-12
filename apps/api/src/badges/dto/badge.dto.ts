import { ApiPropertyOptional } from '@nestjs/swagger';
import { ParticipantRole } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { toBoolean } from '../../common/utils/http-transform.util';

export type BadgeFormat = 'card' | 'a4';

const FORMAT_VALUES: BadgeFormat[] = ['card', 'a4'];

/** Parámetros de `GET /badges/{id}.pdf`. */
export class BadgeSingleQueryDto {
  @ApiPropertyOptional({
    description: '`card` = página del tamaño exacto de la tarjeta; `a4` = tarjeta colocada en hoja A4',
    enum: FORMAT_VALUES,
    default: 'card',
  })
  @IsOptional()
  @IsIn(FORMAT_VALUES, { message: "format debe ser 'card' o 'a4'" })
  format?: BadgeFormat;

  @ApiPropertyOptional({
    description: 'Registra la acción en auditoría como reimpresión (RF-08)',
    default: false,
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  reprint?: boolean;

  @ApiPropertyOptional({ description: 'Motivo de la reimpresión (queda en auditoría)' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;

  @ApiPropertyOptional({ description: '`inline` (por defecto) abre el PDF en el navegador', default: 'inline' })
  @IsOptional()
  @IsIn(['inline', 'attachment'])
  disposition?: 'inline' | 'attachment';
}

/** Cuerpo de `POST /badges/pdf` y `POST /badges/reprint`. */
export class BadgeBatchDto {
  @ApiPropertyOptional({ description: 'Ids explícitos de participantes', type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty({ message: 'participantIds no puede ser una lista vacía' })
  @Type(() => Number)
  @IsInt({ each: true })
  participantIds?: number[];

  @ApiPropertyOptional({ description: 'Filtro por nombre, apellido, código o documento' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ description: 'Filtro por colegio (id)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  schoolId?: number;

  @ApiPropertyOptional({ description: 'Filtro por comité (id)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  committeeId?: number;

  @ApiPropertyOptional({ enum: ParticipantRole, description: 'Filtro por rol' })
  @IsOptional()
  @IsEnum(ParticipantRole)
  role?: ParticipantRole;

  @ApiPropertyOptional({ description: 'Filtro por estado; por defecto solo participantes activos' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: '`a4` (por defecto en lote) coloca 4 credenciales por hoja; `card` genera una página por tarjeta',
    enum: FORMAT_VALUES,
    default: 'a4',
  })
  @IsOptional()
  @IsIn(FORMAT_VALUES, { message: "format debe ser 'card' o 'a4'" })
  format?: BadgeFormat;

  @ApiPropertyOptional({ description: 'Registra cada credencial del lote como reimpresión', default: false })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  reprint?: boolean;

  @ApiPropertyOptional({ description: 'Motivo de la reimpresión (queda en auditoría)' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
