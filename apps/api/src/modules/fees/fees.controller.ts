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
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { FeesService } from './fees.service';
import { CreatePlatformFeeRequestDto } from './dto/create-platform-fee.dto';
import { UpdatePlatformFeeRequestDto } from './dto/update-platform-fee.dto';

@ApiTags('Platform Fees')
@Controller()
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  @Public()
  @Get('fees')
  @ApiOperation({ summary: 'List all active platform fees (public for checkout)' })
  async getActiveFees() {
    return this.feesService.getActiveFees();
  }

  @Get('admin/fees')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.DASHBOARD_READ)
  @ApiOperation({ summary: 'Admin: list all platform fees (active and inactive)' })
  async getAdminFees() {
    return this.feesService.getAllForAdmin();
  }

  @Post('admin/fees')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.DASHBOARD_READ)
  @ApiOperation({ summary: 'Admin: create a new platform fee' })
  async createFee(@Body() dto: CreatePlatformFeeRequestDto) {
    return this.feesService.createFee(dto);
  }

  @Patch('admin/fees/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.DASHBOARD_READ)
  @ApiOperation({ summary: 'Admin: update a platform fee configuration' })
  async updateFee(
    @Param('id') id: string,
    @Body() dto: UpdatePlatformFeeRequestDto,
  ) {
    return this.feesService.updateFee(id, dto);
  }

  @Delete('admin/fees/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.DASHBOARD_READ)
  @ApiOperation({ summary: 'Admin: delete a platform fee configuration' })
  async deleteFee(@Param('id') id: string) {
    return this.feesService.deleteFee(id);
  }
}
