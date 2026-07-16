import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
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
import { RegisterInspectorDto } from './dto/register-inspector.dto';
import { RegisterDriverDto } from './dto/register-driver.dto';
import {
  UpdateFarmerProfileDto,
  UpdateBuyerProfileDto,
} from './dto/profile.dto';
import { CreateParcelDto, VerifyParcelDto } from './dto/parcel.dto';
import { RegisterFarmerProxyDto } from './dto/register-farmer-proxy.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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

  @Post('register/farmer/proxy')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.FARMER_PROXY_CREATE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new Farmer account on their behalf (Inspector/Admin)' })
  @ApiCreatedResponse({
    description: 'The farmer user has been registered successfully.',
  })
  registerFarmerProxy(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterFarmerProxyDto,
  ) {
    return this.usersService.registerFarmerProxy(user.id, dto);
  }

  @Put('profile/farmer/:farmerId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.FARMER_PROXY_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update farmer profile details as proxy' })
  updateFarmerProfileProxy(
    @Param('farmerId') farmerId: string,
    @Body() dto: UpdateFarmerProfileDto,
  ) {
    return this.usersService.updateFarmerProfileProxy(farmerId, dto);
  }

  @Post(':farmerId/parcels')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.FARMER_PROXY_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Submit an agricultural parcel for a farmer as proxy',
  })
  createParcelProxy(
    @Param('farmerId') farmerId: string,
    @Body() dto: CreateParcelDto,
  ) {
    return this.usersService.createParcelProxy(farmerId, dto);
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

  @Post('register/inspector')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.USER_CREATE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Admin: Register a new Inspector account with profile' })
  registerInspector(@Body() dto: RegisterInspectorDto) {
    return this.usersService.registerInspector(dto);
  }

  @Post('register/driver')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.USER_CREATE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Admin: Register a new Driver account with profile' })
  registerDriver(@Body() dto: RegisterDriverDto) {
    return this.usersService.registerDriver(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.USER_READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: List all users (paginated). Supports role, status, and search filters' })
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
  @RequirePermissions(Permission.PARCEL_CREATE)
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

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.USER_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update user details' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.USER_DELETE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Admin: Soft-delete a user' })
  remove(@Param('id') id: string) {
    return this.usersService.softDeleteUser(id);
  }
}
