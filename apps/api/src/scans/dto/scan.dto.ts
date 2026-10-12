import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScanResult, ScanSource } from '@prisma/client';
import { Type } from 'class-transformer';
import {
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

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreateScanDto {
  @ApiPropertyOptional({
    description: 'Código corto leído del QR o digitado a mano (se normaliza)',
    example: 'K7P3Q9',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  code?: string;

  @ApiPropertyOptional({ description: 'Id del participante (registro por búsqueda de nombre)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  participantId?: number;

  @ApiPropertyOptional({ description: 'Id del punto de control' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'checkpointId debe ser un número entero' })
  @Min(1)
  checkpointId?: number;

  @ApiPropertyOptional({ description: 'Alias snake_case de checkpointId (SDD 12.3)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'checkpoint_id debe ser un número entero' })
  @Min(1)
  checkpoint_id?: number;

  @ApiPropertyOptional({ enum: ScanSource, description: 'Origen del registro', default: 'qr' })
  @IsOptional()
  @IsEnum(ScanSource, { message: `source debe ser uno de: ${Object.values(ScanSource).join(', ')}` })
  source?: ScanSource;
}

export class OverrideScanDto extends CreateScanDto {
  @ApiProperty({ description: 'Motivo obligatorio de la excepción (queda en auditoría)' })
  @IsString({ message: 'reason es obligatorio' })
  @MinLength(3, { message: 'reason debe explicar el motivo de la excepción' })
  @MaxLength(300)
  reason: string;
}

export class VoidScanDto {
  @ApiProperty({ description: 'Motivo obligatorio de la anulación (queda en auditoría)' })
  @IsString({ message: 'reason es obligatorio' })
  @MinLength(3, { message: 'reason debe explicar el motivo de la anulación' })
  @MaxLength(300)
  reason: string;
}

export class SearchParticipantsDto {
  @ApiProperty({ description: 'Texto a buscar en nombre, apellido o código' })
  @IsString({ message: 'q es obligatorio' })
  @MinLength(2, { message: 'q debe tener al menos 2 caracteres' })
  @MaxLength(120)
  q: string;

  @ApiPropertyOptional({ description: 'Punto de control en el que se va a registrar' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'checkpointId debe ser un número entero' })
  @Min(1)
  checkpointId?: number;

  @ApiPropertyOptional({ description: 'Alias snake_case de checkpointId' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  checkpoint_id?: number;
}

/** Filtros del historial de escaneos (pantalla de auditoría). */
export class QueryScansDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtra por punto de control' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  checkpointId?: number;

  @ApiPropertyOptional({ description: 'Alias de checkpointId' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  checkpoint_id?: number;

  @ApiPropertyOptional({ description: 'Filtra por el día del evento del punto (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  @Matches(DAY_PATTERN, { message: 'day debe tener el formato YYYY-MM-DD' })
  day?: string;

  @ApiPropertyOptional({ description: 'Desde esta fecha (YYYY-MM-DD), hora del evento' })
  @IsOptional()
  @IsString()
  @Matches(DAY_PATTERN, { message: 'from debe tener el formato YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({ description: 'Hasta esta fecha (YYYY-MM-DD), hora del evento' })
  @IsOptional()
  @IsString()
  @Matches(DAY_PATTERN, { message: 'to debe tener el formato YYYY-MM-DD' })
  to?: string;

  @ApiPropertyOptional({ enum: ScanResult })
  @IsOptional()
  @IsEnum(ScanResult)
  result?: ScanResult;

  @ApiPropertyOptional({ enum: ScanSource })
  @IsOptional()
  @IsEnum(ScanSource)
  source?: ScanSource;

  @ApiPropertyOptional({ description: 'Filtra por operador' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @ApiPropertyOptional({ description: 'Filtra por colegio del participante' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  schoolId?: number;

  @ApiPropertyOptional({ description: 'Búsqueda por participante (nombre, apellido, código o documento)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
