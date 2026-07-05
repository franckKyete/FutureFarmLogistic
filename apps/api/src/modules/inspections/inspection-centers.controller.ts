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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

import { Permission, AuthUser } from '@futurefarm/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

import { InspectionCentersService } from './inspection-centers.service';
import { CreateInspectionCenterDto, UpdateInspectionCenterDto, AssignInspectorDto } from './dto/inspection-center.dto';

@ApiTags('Inspection Centers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inspection-centers')
export class InspectionCentersController {
  constructor(private readonly centersService: InspectionCentersService) {}

  @Post()
  @RequirePermissions(Permission.INSPECTION_CENTER_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Admin: Create a new inspection center' })
  createCenter(@Body() dto: CreateInspectionCenterDto) {
    return this.centersService.createCenter(dto);
  }

  @Get()
  @RequirePermissions(Permission.INSPECTION_CENTER_READ)
  @ApiOperation({ summary: 'List all active/inactive inspection centers' })
  listCenters(
    @Query('regionName') regionName?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const isOnlyActive = activeOnly !== 'false';
    const filter: { regionName?: string; activeOnly?: boolean } = {
      activeOnly: isOnlyActive,
    };
    if (regionName !== undefined) {
      filter.regionName = regionName;
    }
    return this.centersService.listCenters(filter);
  }

  @Get('my-center')
  @RequirePermissions(Permission.INSPECTION_CENTER_READ)
  @ApiOperation({ summary: 'Inspector: Get own currently assigned inspection center' })
  getMyCenter(@CurrentUser() user: AuthUser) {
    return this.centersService.getAssignedCenter(user.id);
  }

  @Get(':id')
  @RequirePermissions(Permission.INSPECTION_CENTER_READ)
  @ApiOperation({ summary: 'Get details of an inspection center' })
  getCenter(@Param('id') id: string) {
    return this.centersService.getCenter(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.INSPECTION_CENTER_UPDATE)
  @ApiOperation({ summary: 'Admin: Update inspection center details' })
  updateCenter(@Param('id') id: string, @Body() dto: UpdateInspectionCenterDto) {
    return this.centersService.updateCenter(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.INSPECTION_CENTER_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Admin: Soft-delete/deactivate an inspection center' })
  deactivateCenter(@Param('id') id: string) {
    return this.centersService.deactivateCenter(id);
  }

  @Post(':id/assign')
  @RequirePermissions(Permission.INSPECTION_CENTER_ASSIGN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Admin/Dispatcher: Assign an inspector to an inspection center' })
  assignInspector(
    @Param('id') id: string,
    @Body() dto: AssignInspectorDto,
  ) {
    return this.centersService.assignInspector(id, dto.inspectorProfileId);
  }

  @Get(':id/inspectors')
  @RequirePermissions(Permission.INSPECTION_CENTER_READ)
  @ApiOperation({ summary: 'List all currently assigned inspectors at a center' })
  listInspectors(@Param('id') id: string) {
    return this.centersService.listInspectorsForCenter(id);
  }
}
