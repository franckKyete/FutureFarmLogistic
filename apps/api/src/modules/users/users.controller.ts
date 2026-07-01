import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
} from '@nestjs/swagger';

import { Permission, AuthUser, UserStatus } from '@futurefarm/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

import { UsersService } from './users.service';
import { RegisterFarmerDto } from './dto/register-farmer.dto';
import { RegisterBuyerDto } from './dto/register-buyer.dto';
import {
  UpdateFarmerProfileDto,
  UpdateBuyerProfileDto,
} from './dto/profile.dto';
import { CreateParcelDto, VerifyParcelDto } from './dto/parcel.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register/farmer')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new Farmer account' })
  @ApiCreatedResponse({
    description: 'The farmer user has been registered successfully.',
  })
  registerFarmer(@Body() dto: RegisterFarmerDto) {
    return this.usersService.registerFarmer(dto);
  }

  @Post('register/buyer')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new Buyer account' })
  @ApiCreatedResponse({
    description: 'The buyer user has been registered successfully.',
  })
  registerBuyer(@Body() dto: RegisterBuyerDto) {
    return this.usersService.registerBuyer(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.USER_READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: List all users (paginated)' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get('profile/farmer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user farmer profile' })
  getFarmerProfile(@CurrentUser() user: AuthUser) {
    return this.usersService.getFarmerProfile(user.id);
  }

  @Get('profile/buyer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user buyer profile' })
  getBuyerProfile(@CurrentUser() user: AuthUser) {
    return this.usersService.getBuyerProfile(user.id);
  }

  @Put('profile/farmer')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PROFILE_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own farmer profile details' })
  updateFarmerProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateFarmerProfileDto,
  ) {
    return this.usersService.updateFarmerProfile(user.id, dto);
  }

  @Put('profile/buyer')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PROFILE_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own buyer profile details' })
  updateBuyerProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBuyerProfileDto,
  ) {
    return this.usersService.updateBuyerProfile(user.id, dto);
  }

  @Post('parcels')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PARCEL_CREATE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Farmer: Submit an agricultural parcel for verification',
  })
  createParcel(@CurrentUser() user: AuthUser, @Body() dto: CreateParcelDto) {
    return this.usersService.createParcel(user.id, dto);
  }

  @Get('parcels/me')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PROFILE_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Farmer: View own land parcels' })
  getMyParcels(@CurrentUser() user: AuthUser) {
    return this.usersService.getMyParcels(user.id);
  }

  @Patch('parcels/:id/verify')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PARCEL_VERIFY)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Inspector: Verify or reject farmer parcel' })
  verifyParcel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: VerifyParcelDto,
  ) {
    return this.usersService.verifyParcel(id, user.id, dto.status);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.USER_VALIDATE)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Admin: Change user account verification status (approve, suspend, ban)',
  })
  updateUserStatus(
    @Param('id') id: string,
    @Body() body: { status: UserStatus },
  ) {
    return this.usersService.updateUserStatus(id, body.status);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.USER_READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a user by ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}
