import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreateCommitteeDto {
  @ApiProperty({ description: 'Nombre del comité o foro', example: 'Consejo de Seguridad' })
  @IsString({ message: 'name debe ser texto' })
  @MinLength(2, { message: 'name debe tener al menos 2 caracteres' })
  @MaxLength(150, { message: 'name no puede superar 150 caracteres' })
  name: string;

  @ApiPropertyOptional({ description: 'Sigla del comité', example: 'CS' })
  @IsOptional()
  @IsString({ message: 'shortName debe ser texto' })
  @MaxLength(30, { message: 'shortName no puede superar 30 caracteres' })
  shortName?: string;
}

export class UpdateCommitteeDto extends PartialType(CreateCommitteeDto) {}

export class QueryCommitteeDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Búsqueda por nombre o sigla (sin distinguir mayúsculas)' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;
}
