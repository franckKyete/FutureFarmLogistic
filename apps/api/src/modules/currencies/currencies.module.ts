import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrencyEntity } from './entities/currency.entity';
import { CurrenciesService } from './currencies.service';
import { CurrenciesController } from './currencies.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CurrencyEntity])],
  controllers: [CurrenciesController],
  providers: [CurrenciesService],
  exports: [CurrenciesService, TypeOrmModule],
})
export class CurrenciesModule {}
