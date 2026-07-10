import {
  Controller,
  Get,
  Post,
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
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Permission, AuthUser, AuctionStatus } from '@futurefarm/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuctionsService } from './auctions.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';

@ApiTags('Auctions & Bidding')
@Controller('auctions')
export class AuctionsController {
  constructor(private readonly auctionsService: AuctionsService) {}

  // =============================================================================
  // Gated Read Endpoints (Must be evaluated before parameterized routes)
  // =============================================================================

  @Get('my-bids')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.BID_READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get caller's own bid history (Buyer)" })
  @ApiOkResponse({ description: 'List of bids placed by caller' })
  async getMyBids(@CurrentUser() user: AuthUser) {
    return this.auctionsService.listMyBids(user.id);
  }

  // =============================================================================
  // Public Browse Endpoints (No Auth Required)
  // =============================================================================

  @Get()
  @ApiOperation({ summary: 'List all auctions (Public)' })
  @ApiOkResponse({ description: 'Paginated list of auctions' })
  async findAll(
    @Query('status') status?: AuctionStatus,
    @Query('harvestId') harvestId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.auctionsService.listAuctions({
      status,
      harvestId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single auction details (Public)' })
  @ApiOkResponse({ description: 'Detailed auction object' })
  async findOne(@Param('id') id: string) {
    return this.auctionsService.getAuction(id);
  }

  // =============================================================================
  // Gated Actions (JWT & RBAC Required)
  // =============================================================================

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.AUCTION_CREATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new auction on a harvest (Farmer)' })
  @ApiCreatedResponse({ description: 'Auction created successfully' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateAuctionDto) {
    return this.auctionsService.createAuction(user.id, dto);
  }

  @Post('proxy')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.FARMER_PROXY_AUCTION_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new auction on a harvest on behalf of a Farmer' })
  @ApiCreatedResponse({ description: 'Auction created successfully' })
  async createProxy(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateAuctionDto & { farmerUserId: string },
  ) {
    const { farmerUserId, ...dto } = body;
    return this.auctionsService.createAuction(user.id, dto, {
      onBehalfOfUserId: farmerUserId,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.AUCTION_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update auction scheduling details (SCHEDULED only)',
  })
  @ApiOkResponse({ description: 'Auction updated successfully' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAuctionDto,
  ) {
    return this.auctionsService.updateAuction(user.id, id, dto);
  }

  @Patch(':id/proxy')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.FARMER_PROXY_AUCTION_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update auction scheduling details on behalf of a Farmer',
  })
  @ApiOkResponse({ description: 'Auction updated successfully' })
  async updateProxy(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateAuctionDto & { farmerUserId: string },
  ) {
    const { farmerUserId, ...dto } = body;
    return this.auctionsService.updateAuction(user.id, id, dto, {
      onBehalfOfUserId: farmerUserId,
    });
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.AUCTION_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel an auction (Farmer/Admin)' })
  @ApiOkResponse({ description: 'Auction cancelled successfully' })
  async cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const isAdmin = user.permissions.includes(Permission.AUCTION_MANAGE);
    return this.auctionsService.cancelAuction(user.id, id, isAdmin);
  }

  @Post(':id/cancel/proxy')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.FARMER_PROXY_AUCTION_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel an auction on behalf of a Farmer' })
  @ApiOkResponse({ description: 'Auction cancelled successfully' })
  async cancelProxy(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { farmerUserId: string },
  ) {
    return this.auctionsService.cancelAuction(user.id, id, false, {
      onBehalfOfUserId: body.farmerUserId,
    });
  }

  @Post(':id/bids')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.BID_CREATE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Place a bid to buy the entire lot at current price (Buyer)',
  })
  @ApiCreatedResponse({ description: 'Bid placed and won successfully' })
  async placeBid(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.auctionsService.placeBid(user.id, id);
  }

  @Post(':id/cancel-bid')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.BID_CANCEL)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel own bid on an auction (Buyer)' })
  @ApiOkResponse({ description: 'Bid cancelled successfully' })
  async cancelBid(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.auctionsService.cancelBid(user.id, id);
  }

  @Get(':id/bids')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.BID_READ_ALL)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all bids for a specific auction (Admin)' })
  @ApiOkResponse({ description: 'List of bids' })
  async findBidsForAuction(@Param('id') id: string) {
    return this.auctionsService.listAllBidsForAdmin(id);
  }
}
