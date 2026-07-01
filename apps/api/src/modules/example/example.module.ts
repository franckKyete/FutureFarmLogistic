/**
 * EXAMPLE MODULE — Scaffold Template
 * ============================================================
 * This module is a complete, copy-paste template for adding
 * new business modules to the API.
 *
 * How to use:
 *   1. Duplicate this directory: cp -r src/modules/example src/modules/my-resource
 *   2. Find & replace "Example"/"example" with your resource name
 *   3. Add your fields to example.entity.ts
 *   4. Add your validation rules to the DTOs
 *   5. Add your permissions to packages/types/src/rbac.types.ts
 *   6. Import your new module in app.module.ts
 * ============================================================
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ExampleEntity } from './entities/example.entity';
import { ExampleController } from './example.controller';
import { ExampleService } from './example.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExampleEntity])],
  controllers: [ExampleController],
  providers: [ExampleService],
  exports: [ExampleService],
})
export class ExampleModule {}
