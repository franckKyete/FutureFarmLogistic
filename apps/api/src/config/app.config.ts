import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  // Render provides PORT at runtime; keep API_PORT as the local override.
  port: Number(process.env['PORT'] ?? process.env['API_PORT'] ?? 3000),
  corsOrigins: process.env['CORS_ORIGINS']?.split(',') ?? [
    'http://localhost:3001',
  ],
}));
