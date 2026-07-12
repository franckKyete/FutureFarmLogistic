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
import { VisitsService } from './visits.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { VisitFilterDto } from './dto/visit-filter.dto';

@ApiTags('Visits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post()
  @RequirePermissions(Permission.VISIT_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Plan a new visit' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVisitDto) {
    return this.visitsService.create(user.id, dto);
  }

  @Get()
  @RequirePermissions(Permission.VISIT_READ)
  @ApiOperation({ summary: 'List visits with optional date/status/producer filters' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: VisitFilterDto,
  ) {
    return this.visitsService.findAll(query, user.id);
  }

  @Get('today')
  @RequirePermissions(Permission.VISIT_READ)
  @ApiOperation({ summary: 'Get visits scheduled for today' })
  getTodayVisits(@CurrentUser() user: AuthUser) {
    return this.visitsService.getTodayVisits(user.id);
  }

  @Get('dashboard')
  @RequirePermissions(Permission.DASHBOARD_READ)
  @ApiOperation({ summary: 'Get aggregated dashboard statistics for inspector' })
  getDashboardStats(@CurrentUser() user: AuthUser) {
    return this.visitsService.getDashboardStats(user.id);
  }

  @Get(':id')
  @RequirePermissions(Permission.VISIT_READ)
  @ApiOperation({ summary: 'Get a single visit by ID' })
  findOne(@Param('id') id: string) {
    return this.visitsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.VISIT_UPDATE)
  @ApiOperation({ summary: 'Reschedule or update a visit' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateVisitDto,
  ) {
    return this.visitsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.VISIT_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a visit' })
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.visitsService.cancel(id, user.id);
  }
}
