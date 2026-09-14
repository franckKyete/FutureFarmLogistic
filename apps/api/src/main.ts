import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // --- Security ---
  app.use(helmet());

  // --- Trust Proxy ---
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // --- Static Files (Uploads) ---
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  // --- CORS ---
  const configuredOrigins = process.env['CORS_ORIGINS']?.split(',').map((s) => s.trim()) ?? [
    'http://localhost:3001',
  ];
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      // In non-production, allow localhost, 127.0.0.1, and any local network IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
      if (
        process.env['NODE_ENV'] !== 'production' ||
        configuredOrigins.includes(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(
          origin,
        )
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  });

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

  const port = Number(process.env['PORT'] ?? process.env['API_PORT'] ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.warn(`🚀 API running on: http://0.0.0.0:${port}`);
  console.warn(`📚 Swagger docs: http://0.0.0.0:${port}/api/docs`);
}

void bootstrap();
