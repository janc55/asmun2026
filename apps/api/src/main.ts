import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4000);
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');

  // Habilitar CORS
  app.enableCors({
    origin: corsOrigin.includes(',') ? corsOrigin.split(',') : corsOrigin,
    credentials: true,
    // El frontend muestra el nombre del archivo y el conteo de filas exportadas.
    exposedHeaders: ['Content-Disposition', 'X-Row-Count'],
  });

  // Prefijo global de API /api/v1 (SDD sección 12)
  app.setGlobalPrefix('api/v1');

  // Filtro de excepciones uniforme ({ code, message })
  app.useGlobalFilters(new HttpExceptionFilter());

  // Validación global de DTOs.
  // Sin `enableImplicitConversion`: class-transformer convertiría el texto
  // 'false' a `true` (Boolean('false')) antes de los @Transform, rompiendo los
  // filtros booleanos de query string y de multipart. La conversión de números
  // se declara explícitamente con @Type(() => Number) en cada DTO.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Documentación OpenAPI / Swagger en /docs (SDD sección 12.1)
  const config = new DocumentBuilder()
    .setTitle('ASMUN Control — API REST')
    .setDescription('API para Registro, Credencialización y Control de Ingresos/Comidas ASMUN')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);
  logger.log(`🚀 Servidor backend NestJS iniciado en: http://localhost:${port}/api/v1`);
  logger.log(`📚 Documentación Swagger disponible en: http://localhost:${port}/docs`);
}

bootstrap();
