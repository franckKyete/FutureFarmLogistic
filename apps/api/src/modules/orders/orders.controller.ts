import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Permission, AuthUser } from '@futurefarm/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { OrdersService } from './orders.service';
import { RejectOrderLineDto } from './dto/reject-order-line.dto';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('seller')
  @RequirePermissions(Permission.ORDER_READ_SELLER)
  @ApiOperation({ summary: "List farmer's sales order items" })
  listSellerOrders(@CurrentUser() user: AuthUser) {
    return this.ordersService.listFarmerOrderLines(user.id);
  }

  @Get('all')
  @RequirePermissions(Permission.ORDER_READ_ALL)
  @ApiOperation({ summary: 'Admin view: list all orders in system' })
  listAllAdmin(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const options: { page?: number; limit?: number } = {};
    if (page !== undefined) options.page = Number(page);
    if (limit !== undefined) options.limit = Number(limit);
    return this.ordersService.listAllOrdersAdmin(options);
  }

  @Post('payments/confirm')
  @ApiOperation({ summary: 'Confirm order payment via gateway reference' })
  confirmPayment(@Query('paymentRef') paymentRef: string) {
    return this.ordersService.confirmPayment(paymentRef);
  }

  @Get()
  @RequirePermissions(Permission.ORDER_READ)
  @ApiOperation({ summary: "List buyer's placed orders" })
  listMyOrders(@CurrentUser() user: AuthUser) {
    return this.ordersService.listMyOrders(user.id);
  }

  @Get(':id')
  @RequirePermissions(Permission.ORDER_READ)
  @ApiOperation({ summary: 'Get details of a specific order' })
  getOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.getOrderForUser(id, user.id, user.permissions);
  }

  @Post(':id/confirm-line/:lineId')
  @RequirePermissions(Permission.ORDER_CONFIRM)
  @ApiOperation({ summary: 'Farmer: Confirm a specific order line' })
  confirmLine(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    return this.ordersService.confirmOrderLine(user.id, id, lineId);
  }

  @Post(':id/reject-line/:lineId')
  @RequirePermissions(Permission.ORDER_REJECT)
  @ApiOperation({ summary: 'Farmer: Reject a specific order line' })
  rejectLine(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: RejectOrderLineDto,
  ) {
    return this.ordersService.rejectOrderLine(user.id, id, lineId, dto);
  }

  @Post(':id/ship')
  @RequirePermissions(Permission.ORDER_SHIP)
  @ApiOperation({ summary: "Farmer: Mark confirmed lines in order as shipped" })
  shipLines(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.shipOrderLines(user.id, id);
  }

  @Post(':id/deliver')
  @RequirePermissions(Permission.ORDER_DELIVER)
  @ApiOperation({ summary: "Farmer: Mark shipped lines in order as delivered" })
  deliverLines(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.deliverOrderLines(user.id, id);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.ORDER_CANCEL)
  @ApiOperation({ summary: 'Buyer: Cancel order' })
  cancelOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.cancelOrder(user.id, id);
  }

  @Post(':id/cancel-force')
  @RequirePermissions(Permission.ORDER_CANCEL_FORCE)
  @ApiOperation({ summary: 'Admin: Force cancel order' })
  cancelForce(@Param('id') id: string) {
    return this.ordersService.cancelOrderForce(id);
  }

  @Post(':id/refund')
  @RequirePermissions(Permission.ORDER_REFUND)
  @ApiOperation({ summary: 'Admin: Refund order manually' })
  refundManual(@Param('id') id: string) {
    return this.ordersService.refundOrderManual(id);
  }

  @Post(':id/override-fee')
  @RequirePermissions(Permission.ORDER_FEE_OVERRIDE)
  @ApiOperation({ summary: 'Admin: Override or waive cancellation fee' })
  overrideFee(@Param('id') id: string, @Body('fee') fee: number) {
    return this.ordersService.overrideFee(id, fee);
  }
}
