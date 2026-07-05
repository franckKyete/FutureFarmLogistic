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
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';

import {
  Permission,
  AuthUser,
  HarvestStatus,
  ProductCategory,
} from '@futurefarm/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateHarvestDto } from './dto/create-harvest.dto';
import { UpdateHarvestDto } from './dto/update-harvest.dto';
import { VerifyHarvestDto } from './dto/verify-harvest.dto';
import { AiSuggestHarvestDto } from './dto/ai-suggest.dto';

@ApiTags('Products & Harvests')
@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // =============================================================================
  // Product Crop Templates
  // =============================================================================

  @Post('products')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PRODUCT_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new static product crop template' })
  @ApiCreatedResponse({
    description: 'The product template has been created successfully.',
  })
  createProduct(@Body() dto: CreateProductDto) {
    return this.productsService.createProduct(dto);
  }

  @Get('products')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PRODUCT_READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List crop templates' })
  @ApiOkResponse({ description: 'List of crop templates' })
  findAllProducts(@Query('category') category?: ProductCategory) {
    return this.productsService.findAllProducts(category);
  }

  // =============================================================================
  // Physical Harvest Batches
  // =============================================================================

  @Post('harvests')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.HARVEST_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Record a new physical harvest batch (Farmer only)',
  })
  @ApiCreatedResponse({
    description: 'The harvest batch has been recorded successfully.',
  })
  createHarvest(@CurrentUser() user: AuthUser, @Body() dto: CreateHarvestDto) {
    return this.productsService.createHarvest(user.id, dto);
  }

  @Post('harvests/proxy')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.FARMER_PROXY_HARVEST_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Record a new physical harvest batch on behalf of a Farmer',
  })
  createHarvestProxy(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateHarvestDto & { farmerUserId: string },
  ) {
    const { farmerUserId, ...dto } = body;
    return this.productsService.createHarvest(user.id, dto, {
      onBehalfOfUserId: farmerUserId,
    });
  }

  @Get('harvests')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.HARVEST_READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List harvest batches' })
  @ApiOkResponse({ description: 'List of harvest batches' })
  async findAllHarvests(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: HarvestStatus,
    @Query('category') category?: ProductCategory,
    @Query('productId') productId?: string,
    @Query('farmerProfileId') farmerProfileId?: string,
  ) {
    const hasReadAll = user.permissions.includes(Permission.HARVEST_READ_ALL);
    return this.productsService.findAllHarvests({
      status: hasReadAll ? status : HarvestStatus.APPROVED,
      category,
      productId,
      farmerProfileId,
      isPublicView: !hasReadAll,
    });
  }

  @Get('harvests/farmer')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.HARVEST_READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get caller farmer own harvest batches' })
  @ApiOkResponse({ description: 'List of farmer own harvest batches' })
  async findFarmerHarvests(@CurrentUser() user: AuthUser) {
    // Find all harvests matching the farmer's profile, including pending/rejected (not public view)
    return this.productsService
      .findAllHarvests({
        isPublicView: false,
      })
      .then((harvests) => {
        // Filter harvests that belong to this user
        // Note: we can filter programmatically or query by farmer profile ID
        // Let's filter programmatically to keep the service API clean
        return harvests.filter((h) => h.farmerProfile.userId === user.id);
      });
  }

  @Get('harvests/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.HARVEST_READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get details of a specific harvest batch' })
  @ApiOkResponse({ description: 'Harvest details' })
  findHarvestById(@Param('id') id: string) {
    return this.productsService.findHarvestById(id);
  }

  @Get('harvests/:id/price')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.HARVEST_READ)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Calculate current decayed dynamic price for a harvest batch',
  })
  @ApiOkResponse({ description: 'Decayed dynamic price' })
  getDecayedPrice(@Param('id') id: string) {
    return this.productsService.getDecayedPrice(id);
  }

  @Patch('harvests/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.HARVEST_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Update harvest batch details (Farmer owner only, resets approval)',
  })
  @ApiOkResponse({ description: 'The harvest batch has been updated.' })
  updateHarvest(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateHarvestDto,
  ) {
    return this.productsService.updateHarvest(id, user.id, dto);
  }

  @Patch('harvests/:id/proxy')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.FARMER_PROXY_HARVEST_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update harvest batch details on behalf of a Farmer',
  })
  updateHarvestProxy(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateHarvestDto & { farmerUserId: string },
  ) {
    const { farmerUserId, ...dto } = body;
    return this.productsService.updateHarvest(id, user.id, dto, {
      onBehalfOfUserId: farmerUserId,
    });
  }

  @Delete('harvests/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.HARVEST_DELETE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive a harvest batch (Farmer owner only)' })
  @ApiOkResponse({ description: 'The harvest batch has been archived.' })
  deleteHarvest(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.productsService.deleteHarvest(id, user.id);
  }

  @Delete('harvests/:id/proxy')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.FARMER_PROXY_HARVEST_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive a harvest batch on behalf of a Farmer' })
  @ApiOkResponse({ description: 'The harvest batch has been archived.' })
  deleteHarvestProxy(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { farmerUserId: string },
  ) {
    return this.productsService.deleteHarvest(id, user.id, {
      onBehalfOfUserId: body.farmerUserId,
    });
  }

  @Patch('harvests/:id/verify')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.HARVEST_VERIFY)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Approve or reject a harvest batch with quality score (Inspector/Admin)',
  })
  @ApiOkResponse({ description: 'Verification complete.' })
  verifyHarvest(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: VerifyHarvestDto,
  ) {
    return this.productsService.verifyHarvest(id, user.id, dto);
  }

  @Post('harvests/ai-suggest')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.HARVEST_CREATE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate listing recommendation for crop harvest using Gemini AI',
  })
  @ApiOkResponse({
    description: 'Recommended crop template mapping and text properties',
  })
  aiSuggest(@Body() dto: AiSuggestHarvestDto) {
    return this.productsService.aiSuggest(dto.prompt);
  }
}
