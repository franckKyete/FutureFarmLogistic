import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  url: process.env['DATABASE_URL'],
  host: process.env['POSTGRES_HOST'] ?? 'localhost',
  port: Number(process.env['POSTGRES_PORT'] ?? 5432),
  name: process.env['POSTGRES_DB'] ?? 'futurefarm',
  username: process.env['POSTGRES_USER'] ?? 'futurefarm',
  password: process.env['POSTGRES_PASSWORD'] ?? 'changeme',
}));
