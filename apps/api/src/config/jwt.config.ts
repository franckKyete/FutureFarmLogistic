import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env['JWT_SECRET'],
  accessTokenExpiry: process.env['JWT_ACCESS_TOKEN_EXPIRY'] ?? '15m',
  refreshTokenExpiry: process.env['JWT_REFRESH_TOKEN_EXPIRY'] ?? '7d',
}));
