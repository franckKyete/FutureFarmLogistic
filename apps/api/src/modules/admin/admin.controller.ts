import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

import { Permission } from '@futurefarm/types';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @RequirePermissions(Permission.DASHBOARD_READ)
  @ApiOperation({ summary: 'Get aggregated admin dashboard statistics' })
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('analytics')
  @RequirePermissions(Permission.DASHBOARD_READ)
  @ApiOperation({ summary: 'Get admin analytics (revenue by month, orders by status, users by role, top products)' })
  async getAnalytics() {
    return this.adminService.getAnalytics();
  }
}
