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
import { DriverProfileService } from './driver-profile.service';
import { CreateDriverProfileDto, UpdateDriverProfileDto } from './dto/driver-profile.dto';

@ApiTags('Driver Profiles')
@Controller('logistics/drivers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class DriverProfileController {
  constructor(private readonly driverService: DriverProfileService) {}

  @Post()
  @RequirePermissions(Permission.DRIVER_PROFILE_UPDATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Admin: Create a driver profile for a user' })
  create(@Body() dto: CreateDriverProfileDto) {
    return this.driverService.createProfile(dto);
  }

  @Get('profile/me')
  @RequirePermissions(Permission.DRIVER_PROFILE_READ)
  @ApiOperation({ summary: 'Driver: Get own driver profile' })
  getMe(@CurrentUser() user: AuthUser) {
    return this.driverService.getProfileByUserId(user.id);
  }

  @Patch('profile/me')
  @RequirePermissions(Permission.DRIVER_PROFILE_UPDATE)
  @ApiOperation({ summary: 'Driver: Update own driver profile' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateDriverProfileDto) {
    return this.driverService.updateProfileByUserId(user.id, dto);
  }

  @Get()
  @RequirePermissions(Permission.DELIVERY_RUN_READ_ALL)
  @ApiOperation({ summary: 'Admin: List all driver profiles (paginated)' })
  list(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.driverService.listProfiles(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get(':userId')
  @RequirePermissions(Permission.DELIVERY_RUN_READ_ALL)
  @ApiOperation({ summary: 'Admin: Get driver profile for specific user' })
  getOne(@Param('userId') userId: string) {
    return this.driverService.getProfileByUserId(userId);
  }

  @Delete(':userId')
  @RequirePermissions(Permission.DRIVER_PROFILE_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Admin: Delete driver profile' })
  remove(@Param('userId') userId: string) {
    return this.driverService.deleteProfileByUserId(userId);
  }
}
