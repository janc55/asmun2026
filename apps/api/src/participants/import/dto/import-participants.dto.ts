import { ApiPropertyOptional } from '@nestjs/swagger';
import { ParticipantRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { toBoolean } from '../../../common/utils/http-transform.util';

export class ImportParticipantsDto {
  @ApiPropertyOptional({
    description:
      'false (por defecto) devuelve solo la vista previa; true confirma la importación de las filas válidas.',
    default: false,
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  confirm?: boolean = false;

  @ApiPropertyOptional({
    description: 'Crea automáticamente los colegios y comités que no existan',
    default: true,
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  createMissingCatalogs?: boolean = true;

  @ApiPropertyOptional({
    description: 'Rol por defecto cuando el archivo no trae columna de rol',
    enum: ParticipantRole,
    default: ParticipantRole.delegado,
  })
  @IsOptional()
  @IsEnum(ParticipantRole)
  defaultRole?: ParticipantRole;

  @ApiPropertyOptional({
    description: 'Colegio por defecto cuando el archivo no trae columna de colegio',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  defaultSchoolName?: string;
}
