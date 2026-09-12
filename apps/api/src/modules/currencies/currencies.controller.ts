import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Permission } from '@futurefarm/types';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrenciesService } from './currencies.service';
import { UpdateCurrencyRateDto } from './dto/update-currency-rate.dto';

@ApiTags('Currencies')
@Controller()
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Public()
  @Get('currencies')
  @ApiOperation({ summary: 'List all active currencies' })
  async getCurrencies() {
    return this.currenciesService.getAllActive();
  }

  @Public()
  @Get('currencies/countries')
  @ApiOperation({ summary: 'List all supported countries and their currency configurations' })
  async getCountries() {
    return this.currenciesService.getCountryConfigs();
  }

  @Get('admin/currencies')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.DASHBOARD_READ)
  @ApiOperation({ summary: 'Admin: list all currencies with exchange rates' })
  async getAdminCurrencies() {
    return this.currenciesService.getAllForAdmin();
  }

  @Get('admin/currencies/live')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.DASHBOARD_READ)
  @ApiOperation({ summary: 'Admin: get live exchange rates against USD from external market API' })
  async getLiveRates() {
    return this.currenciesService.getLiveRates();
  }

  @Patch('admin/currencies/:code')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.DASHBOARD_READ)
  @ApiOperation({ summary: 'Admin: update exchange rate or active status of a currency' })
  async updateCurrency(
    @Param('code') code: string,
    @Body() dto: UpdateCurrencyRateDto,
  ) {
    return this.currenciesService.updateRate(code, dto);
  }

  @Post('admin/currencies/sync')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.DASHBOARD_READ)
  @ApiOperation({ summary: 'Admin: sync all active currencies with external live market rates' })
  async syncCurrencies() {
    return this.currenciesService.syncLiveRates();
  }
}
