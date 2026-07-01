import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

import { Permission } from '@futurefarm/types';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ExampleService } from './example.service';
import { CreateExampleDto, UpdateExampleDto } from './dto/example.dto';

@ApiTags('Example')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('examples')
export class ExampleController {
  constructor(private readonly exampleService: ExampleService) {}

  @Get()
  @RequirePermissions(Permission.EXAMPLE_READ)
  @ApiOperation({ summary: 'List all examples (paginated)' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.exampleService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(Permission.EXAMPLE_READ)
  @ApiOperation({ summary: 'Get an example by ID' })
  findOne(@Param('id') id: string) {
    return this.exampleService.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.EXAMPLE_CREATE)
  @ApiOperation({ summary: 'Create a new example' })
  create(@Body() dto: CreateExampleDto) {
    return this.exampleService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.EXAMPLE_UPDATE)
  @ApiOperation({ summary: 'Update an example' })
  update(@Param('id') id: string, @Body() dto: UpdateExampleDto) {
    return this.exampleService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.EXAMPLE_DELETE)
  @ApiOperation({ summary: 'Delete an example' })
  remove(@Param('id') id: string) {
    return this.exampleService.remove(id);
  }
}
