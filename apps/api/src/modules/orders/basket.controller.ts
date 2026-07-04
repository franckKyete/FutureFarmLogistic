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
import { Permission, AuthUser } from '@futurefarm/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { BasketService } from './basket.service';
import { OrdersService } from './orders.service';
import { AddBasketLineDto } from './dto/add-basket-line.dto';
import { UpdateBasketLineDto } from './dto/update-basket-line.dto';
import { CheckoutDto } from './dto/checkout.dto';

@ApiTags('Baskets')
@Controller('basket')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class BasketController {
  constructor(
    private readonly basketService: BasketService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get()
  @RequirePermissions(Permission.BASKET_MANAGE)
  @ApiOperation({ summary: 'Get current active shopping basket' })
  getBasket(@CurrentUser() user: AuthUser) {
    return this.basketService.getOrCreateBasket(user.id);
  }

  @Post('lines')
  @RequirePermissions(Permission.BASKET_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a new line item to the shopping basket' })
  addLine(@CurrentUser() user: AuthUser, @Body() dto: AddBasketLineDto) {
    return this.basketService.addBasketLine(user.id, dto);
  }

  @Patch('lines/:lineId')
  @RequirePermissions(Permission.BASKET_MANAGE)
  @ApiOperation({ summary: 'Update quantity of a specific basket line item' })
  updateLine(
    @CurrentUser() user: AuthUser,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateBasketLineDto,
  ) {
    return this.basketService.updateBasketLine(user.id, lineId, dto);
  }

  @Delete('lines/:lineId')
  @RequirePermissions(Permission.BASKET_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a specific line item from the basket' })
  removeLine(@CurrentUser() user: AuthUser, @Param('lineId') lineId: string) {
    return this.basketService.removeBasketLine(user.id, lineId);
  }

  @Post('checkout')
  @RequirePermissions(Permission.ORDER_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Checkout active basket and generate a new order' })
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.ordersService.checkout(user.id, dto);
  }
}
