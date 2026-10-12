import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ParticipantRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class QueryDashboardDto {
  @ApiPropertyOptional({ description: 'Filtra el panel por día del evento (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  @Matches(DAY_PATTERN, { message: 'day debe tener el formato YYYY-MM-DD' })
  day?: string;

  @ApiPropertyOptional({ description: 'Filtra el panel por un punto de control' })
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
}

export class QueryPendingDto extends PaginationQueryDto {
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

  @ApiPropertyOptional({ description: 'Alias de schoolId' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  school?: number;

  @ApiPropertyOptional({ description: 'Búsqueda por nombre, apellido, código o documento' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: ParticipantRole, description: 'Filtra por rol' })
  @IsOptional()
  @IsEnum(ParticipantRole)
  role?: ParticipantRole;
}
