import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  Body,
  Controller,
  Module,
  Post,
  UploadedFile,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { HttpExceptionFilter } from './src/common/filters/http-exception.filter';

@Controller('participants/import')
class ProbeController {
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: any, @Body() body: any) {
    return { receivedFile: file?.originalname ?? null, size: file?.size ?? 0, body };
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

(async () => {
  const app = await NestFactory.create(ProbeModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(4111);

  const boundary = '----WebKitFormBoundaryABC123';
  const payload = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="planilla.xlsx"',
    'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '',
    'PK\u0003\u0004fake',
    `--${boundary}`,
    'Content-Disposition: form-data; name="confirm"',
    '',
    'false',
    `--${boundary}--`,
    '',
  ].join('\r\n');

  for (const contentType of ['application/json', `multipart/form-data; boundary=${boundary}`]) {
    const res = await fetch('http://127.0.0.1:4111/api/v1/participants/import', {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: payload,
    });
    console.log(`\nContent-Type enviado: ${contentType}`);
    console.log('  status:', res.status);
    console.log('  body  :', (await res.text()).slice(0, 300));
  }

  await app.close();
})();
