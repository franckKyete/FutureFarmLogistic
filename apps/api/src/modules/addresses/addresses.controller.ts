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
import { AuthUser, AddressableType } from '@futurefarm/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@ApiTags('Addresses')
@Controller('addresses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get('me')
  @ApiOperation({ summary: "List current authenticated user's addresses" })
  async getMyAddresses(@CurrentUser() user: AuthUser) {
    return this.addressesService.listForUser(user.id);
  }

  @Post('me')
  @ApiOperation({ summary: 'Add a new address to current user address book' })
  async createMyAddress(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAddressDto,
  ) {
    return this.addressesService.createForUser(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get address by ID' })
  async getAddressById(@Param('id') id: string) {
    return this.addressesService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update address by ID' })
  async updateAddress(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.update(id, user.id, dto);
  }

  @Post(':id/set-default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set address as primary default' })
  async setDefaultAddress(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.addressesService.setDefault(id, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete address by ID' })
  async deleteAddress(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.addressesService.delete(id, user.id);
  }

  @Get(':addressableType/:addressableId')
  @ApiOperation({ summary: 'Get addresses for a specific addressable entity' })
  async getForAddressable(
    @Param('addressableType') addressableType: AddressableType,
    @Param('addressableId') addressableId: string,
  ) {
    return this.addressesService.listForAddressable(addressableType, addressableId);
  }
}
