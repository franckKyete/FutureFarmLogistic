import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../modules/users/entities/user.entity';
import { RoleEntity } from '../modules/roles/entities/role.entity';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL') || '',
        autoLoadEntities: true,
        synchronize: config.get<string>('app.nodeEnv') === 'development',
        logging: config.get<string>('app.nodeEnv') === 'development',
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: false,
      }),
    }),
    TypeOrmModule.forFeature([UserEntity, RoleEntity]),
  ],
  providers: [SeedService],
})
export class DatabaseModule {}
