import {
  Controller,
  Post,
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

import { InspectionsService } from './inspections.service';
import { AiClassifyHarvestDtoClass } from './dto/ai-classify-harvest.dto';

@ApiTags('Products & Harvests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('harvests')
export class HarvestClassifyController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  @Post('ai-classify')
  @RequirePermissions(Permission.HARVEST_CREATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Classify crop type and pre-fill details from photos',
  })
  classify(@Body() dto: AiClassifyHarvestDtoClass) {
    return this.inspectionsService.classifyHarvest(dto);
  }
}
