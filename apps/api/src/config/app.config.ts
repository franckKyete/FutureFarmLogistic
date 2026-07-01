import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  port: Number(process.env['API_PORT'] ?? 3000),
  corsOrigins: process.env['CORS_ORIGINS']?.split(',') ?? [
    'http://localhost:3001',
  ],
}));
