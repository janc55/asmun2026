import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ParticipantsImportService } from './participants-import.service';
import { ImportParticipantsDto } from './dto/import-participants.dto';

/** Forma mínima del archivo que entrega multer con almacenamiento en memoria. */
interface UploadedFileLike {
  originalname: string;
  mimetype?: string;
  size: number;
  buffer: Buffer;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('Participantes · Importación')
@ApiBearerAuth()
@Controller('participants/import')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ParticipantsImportController {
  constructor(private readonly importService: ParticipantsImportService) {}

  @Get('template')
  @Roles(UserRole.admin, UserRole.registrador)
  @ApiOperation({ summary: 'Descarga la plantilla XLSX de importación de participantes' })
  async template(): Promise<StreamableFile> {
    const buffer = await this.importService.buildTemplate();
    return new StreamableFile(buffer, {
      type: XLSX_MIME,
      disposition: 'attachment; filename="plantilla_participantes.xlsx"',
      length: buffer.length,
    });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.admin, UserRole.registrador)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Archivo Excel/CSV y opciones de la importación',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        confirm: { type: 'boolean', default: false },
        createMissingCatalogs: { type: 'boolean', default: true },
        defaultRole: { type: 'string', example: 'delegado' },
        defaultSchoolName: { type: 'string' },
      },
      required: ['file'],
    },
  })
  @ApiOperation({
    summary:
      'Importa participantes desde Excel/CSV. Sin confirm=true devuelve solo la vista previa con los errores por fila.',
  })
  @ApiResponse({ status: 200, description: 'Vista previa o resultado de la importación' })
  @ApiResponse({ status: 400, description: 'Archivo ilegible o columnas obligatorias no reconocidas' })
  async import(
    @UploadedFile() file: UploadedFileLike,
    @Body() dto: ImportParticipantsDto,
  ) {
    return this.importService.import(file, dto);
  }
}
