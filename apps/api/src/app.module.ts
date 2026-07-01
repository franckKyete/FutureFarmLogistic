import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';

import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { jwtConfig } from './config/jwt.config';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    // --- Configuration (global, validated on startup) ---
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      load: [appConfig, databaseConfig, jwtConfig],
      validate: validateEnv,
      cache: true,
    }),

    // --- Bull Queue Queueing (Redis connection) ---
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get<string>('REDIS_URL') || 'redis://localhost:6379',
      }),
    }),

    // --- Database ---
    DatabaseModule,

    // --- Feature Modules ---
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    NotificationsModule,
  ],
})
export class AppModule {}
