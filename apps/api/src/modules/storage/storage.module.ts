import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { STORAGE_PORT } from '../logistics/interfaces/storage.port';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    StorageService,
    {
      provide: STORAGE_PORT,
      useExisting: StorageService,
    },
  ],
  exports: [StorageService, STORAGE_PORT],
})
export class StorageModule {}
