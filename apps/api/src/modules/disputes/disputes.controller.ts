import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

import { Permission } from '@futurefarm/types';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { DisputesService } from './disputes.service';
import { CreateDisputeDtoClass } from './dto/create-dispute.dto';
import { UpdateDisputeDtoClass } from './dto/update-dispute.dto';
import { ResolveDisputeDtoClass } from './dto/resolve-dispute.dto';

@ApiTags('Disputes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  @RequirePermissions(Permission.DISPUTE_READ)
  @ApiOperation({ summary: 'List all disputes' })
  findAll() {
    return this.disputesService.findAll();
  }

  @Get(':id')
  @RequirePermissions(Permission.DISPUTE_READ)
  @ApiOperation({ summary: 'Get a dispute by ID' })
  findOne(@Param('id') id: string) {
    return this.disputesService.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.DISPUTE_CREATE)
  @ApiOperation({ summary: 'Create a new dispute' })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateDisputeDtoClass) {
    return this.disputesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.DISPUTE_UPDATE)
  @ApiOperation({ summary: 'Update a dispute' })
  update(@Param('id') id: string, @Body() dto: UpdateDisputeDtoClass) {
    return this.disputesService.update(id, dto);
  }

  @Patch(':id/resolve')
  @RequirePermissions(Permission.DISPUTE_RESOLVE)
  @ApiOperation({ summary: 'Resolve or dismiss a dispute' })
  resolve(@Param('id') id: string, @Body() dto: ResolveDisputeDtoClass) {
    return this.disputesService.resolve(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DISPUTE_UPDATE)
  @ApiOperation({ summary: 'Delete a dispute' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.disputesService.remove(id);
  }
}
