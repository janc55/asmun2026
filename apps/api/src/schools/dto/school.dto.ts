import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreateSchoolDto {
  @ApiProperty({ description: 'Nombre del colegio o delegación', example: 'Colegio Americano de Oruro' })
  @IsString({ message: 'name debe ser texto' })
  @MinLength(2, { message: 'name debe tener al menos 2 caracteres' })
  @MaxLength(150, { message: 'name no puede superar 150 caracteres' })
  name: string;

  @ApiPropertyOptional({ description: 'Ciudad del colegio', example: 'Oruro' })
  @IsOptional()
  @IsString({ message: 'city debe ser texto' })
  @MaxLength(100, { message: 'city no puede superar 100 caracteres' })
  city?: string;
}

export class UpdateSchoolDto extends PartialType(CreateSchoolDto) {}

export class QuerySchoolDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Búsqueda por nombre (sin distinguir mayúsculas)' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;
}
