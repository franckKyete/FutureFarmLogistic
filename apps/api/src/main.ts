import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // --- Security ---
  app.use(helmet());

  // --- CORS ---
  const corsOrigins = process.env['CORS_ORIGINS']?.split(',') ?? [
    'http://localhost:3001',
  ];
  app.enableCors({ origin: corsOrigins, credentials: true });

  // --- API Versioning ---
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // --- Global Pipes ---
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // --- Global Filters ---
  app.useGlobalFilters(new HttpExceptionFilter());

  // --- Global Interceptors ---
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseTransformInterceptor(),
  );

  // --- Swagger ---
  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Future Farm Logistic API')
      .setDescription('REST API for the Future Farm Logistic platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env['API_PORT'] ?? 3000;
  await app.listen(port);
  console.warn(`🚀 API running on: http://localhost:${port}`);
  console.warn(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}

void bootstrap();
