import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Acciones auditadas del sistema (SDD 7.2, RNF-05). */
export const AUDIT_ACTIONS = ['excepcion', 'anular_scan', 'reimpresion'] as const;

export class QueryAuditDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AUDIT_ACTIONS, description: 'Filtra por tipo de acción' })
  @IsOptional()
  @IsIn(AUDIT_ACTIONS as unknown as string[], {
    message: `action debe ser una de: ${AUDIT_ACTIONS.join(', ')}`,
  })
  action?: string;

  @ApiPropertyOptional({ description: 'Filtra por usuario responsable' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @ApiPropertyOptional({ description: 'Filtra por entidad afectada (participant, scan, badge)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entity?: string;

  @ApiPropertyOptional({ description: 'Filtra por id de la entidad afectada' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entityId?: string;

  @ApiPropertyOptional({ description: 'Búsqueda libre en el motivo' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

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
}
