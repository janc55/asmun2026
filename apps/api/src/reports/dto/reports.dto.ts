import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ParticipantRole, ScanResult, ScanSource } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { toBoolean } from '../../common/utils/http-transform.util';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ReportParticipantsQueryDto {
  @ApiPropertyOptional({ description: 'Búsqueda por nombre, apellido, código o documento' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ description: 'Filtra por colegio' })
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

  @ApiPropertyOptional({ description: 'Filtra por comité' })
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

  @ApiPropertyOptional({ enum: ParticipantRole })
  @IsOptional()
  @IsEnum(ParticipantRole)
  role?: ParticipantRole;

  @ApiPropertyOptional({ description: 'Filtra por habilitado/deshabilitado; por defecto se exportan todos' })
  @IsOptional()
  @Transform(toBoolean)
  isActive?: boolean;
}

export class ReportScansQueryDto {
  @ApiPropertyOptional({ description: 'Día del evento del punto de control (YYYY-MM-DD)' })
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

  @ApiPropertyOptional({ enum: ScanResult, description: 'Filtra por resultado' })
  @IsOptional()
  @IsEnum(ScanResult)
  result?: ScanResult;

  @ApiPropertyOptional({ enum: ScanSource, description: 'Filtra por origen del registro' })
  @IsOptional()
  @IsEnum(ScanSource)
  source?: ScanSource;

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

export class ReportPendingQueryDto {
  @ApiProperty({ description: 'Punto de control del que se listan los pendientes' })
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

  @ApiPropertyOptional({ description: 'Filtra por colegio' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  schoolId?: number;

  @ApiPropertyOptional({ enum: ParticipantRole })
  @IsOptional()
  @IsEnum(ParticipantRole)
  role?: ParticipantRole;
}

export class ReportFormatQueryDto {
  @ApiPropertyOptional({ enum: ['xlsx'], default: 'xlsx' })
  @IsOptional()
  @IsIn(['xlsx'])
  format?: 'xlsx';
}
