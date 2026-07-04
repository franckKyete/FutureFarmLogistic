import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import {
  ProductCategory,
  HarvestStatus,
  AiSuggestHarvestResponseDto,
} from '@futurefarm/types';
import { ProductEntity } from './entities/product.entity';
import { HarvestEntity } from './entities/harvest.entity';
import { FarmerProfileEntity } from '../users/entities/farmer-profile.entity';
import { ParcelEntity } from '../users/entities/parcel.entity';

import { CreateProductDto } from './dto/create-product.dto';
import { CreateHarvestDto } from './dto/create-harvest.dto';
import { UpdateHarvestDto } from './dto/update-harvest.dto';
import { VerifyHarvestDto } from './dto/verify-harvest.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(HarvestEntity)
    private readonly harvestRepository: Repository<HarvestEntity>,
    @InjectRepository(FarmerProfileEntity)
    private readonly farmerProfileRepository: Repository<FarmerProfileEntity>,
    @InjectRepository(ParcelEntity)
    private readonly parcelRepository: Repository<ParcelEntity>,
    private readonly configService: ConfigService,
  ) {}

  // =============================================================================
  // Product Crop Templates
  // =============================================================================

  async createProduct(dto: CreateProductDto): Promise<ProductEntity> {
    const existing = await this.productRepository.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new BadRequestException(
        `Product template with name "${dto.name}" already exists.`,
      );
    }

    const product = this.productRepository.create(dto);
    return this.productRepository.save(product);
  }

  async findAllProducts(category?: ProductCategory): Promise<ProductEntity[]> {
    const query = this.productRepository.createQueryBuilder('product');
    if (category) {
      query.where('product.category = :category', { category });
    }
    return query.orderBy('product.name', 'ASC').getMany();
  }

  async findProductById(id: string): Promise<ProductEntity> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(
        `Product template with ID "${id}" not found.`,
      );
    }
    return product;
  }

  // =============================================================================
  // Harvest Batches
  // =============================================================================

  async createHarvest(
    userId: string,
    dto: CreateHarvestDto,
  ): Promise<HarvestEntity> {
    const farmerProfile = await this.farmerProfileRepository.findOne({
      where: { userId },
    });
    if (!farmerProfile) {
      throw new ForbiddenException(
        'Only registered farmers can create harvest listings.',
      );
    }

    await this.findProductById(dto.productId);

    // If parcel is provided, verify it belongs to this farmer profile
    if (dto.parcelId) {
      const parcel = await this.parcelRepository.findOne({
        where: { id: dto.parcelId },
      });
      if (!parcel) {
        throw new NotFoundException(
          `Specified parcel with ID "${dto.parcelId}" not found.`,
        );
      }
      if (parcel.farmerProfileId !== farmerProfile.id) {
        throw new ForbiddenException(
          'The specified land parcel does not belong to your profile.',
        );
      }
    }

    const harvest = this.harvestRepository.create({
      ...dto,
      farmerProfileId: farmerProfile.id,
      status: HarvestStatus.PENDING_APPROVAL,
    });

    return this.harvestRepository.save(harvest);
  }

  async updateHarvest(
    id: string,
    userId: string,
    dto: UpdateHarvestDto,
  ): Promise<HarvestEntity> {
    const harvest = await this.harvestRepository.findOne({ where: { id } });
    if (!harvest) {
      throw new NotFoundException(`Harvest batch with ID "${id}" not found.`);
    }

    const farmerProfile = await this.farmerProfileRepository.findOne({
      where: { userId },
    });
    if (!farmerProfile || harvest.farmerProfileId !== farmerProfile.id) {
      throw new ForbiddenException('You do not own this harvest batch.');
    }

    // Reset status to PENDING_APPROVAL on update to ensure inspectors re-verify modifications
    Object.assign(harvest, {
      ...dto,
      status: HarvestStatus.PENDING_APPROVAL,
      approvedById: null,
      approvedAt: null,
      rejectionReason: null,
    });

    return this.harvestRepository.save(harvest);
  }

  async findHarvestById(id: string): Promise<HarvestEntity> {
    const harvest = await this.harvestRepository.findOne({
      where: { id },
      relations: ['product', 'farmerProfile'],
    });

    if (!harvest) {
      throw new NotFoundException(`Harvest batch with ID "${id}" not found.`);
    }
    return harvest;
  }

  async deleteHarvest(id: string, userId: string): Promise<void> {
    const harvest = await this.harvestRepository.findOne({ where: { id } });
    if (!harvest) {
      throw new NotFoundException(`Harvest batch with ID "${id}" not found.`);
    }

    const farmerProfile = await this.farmerProfileRepository.findOne({
      where: { userId },
    });
    if (!farmerProfile || harvest.farmerProfileId !== farmerProfile.id) {
      throw new ForbiddenException('You do not own this harvest batch.');
    }

    // Archive instead of hard delete
    harvest.status = HarvestStatus.ARCHIVED;
    await this.harvestRepository.save(harvest);
  }

  async findAllHarvests(options: {
    status?: HarvestStatus | undefined;
    category?: ProductCategory | undefined;
    productId?: string | undefined;
    farmerProfileId?: string | undefined;
    isPublicView?: boolean | undefined;
  }): Promise<HarvestEntity[]> {
    const qb = this.harvestRepository.createQueryBuilder('harvest');
    qb.leftJoinAndSelect('harvest.product', 'product');
    qb.leftJoinAndSelect('harvest.farmerProfile', 'farmerProfile');

    if (options.isPublicView) {
      // Public search only sees approved items
      qb.andWhere('harvest.status = :approvedStatus', {
        approvedStatus: HarvestStatus.APPROVED,
      });
    } else if (options.status) {
      qb.andWhere('harvest.status = :status', { status: options.status });
    } else {
      // Default exclude archived from general admin list unless specifically requested
      qb.andWhere('harvest.status != :archivedStatus', {
        archivedStatus: HarvestStatus.ARCHIVED,
      });
    }

    if (options.category) {
      qb.andWhere('product.category = :category', {
        category: options.category,
      });
    }

    if (options.productId) {
      qb.andWhere('harvest.product_id = :productId', {
        productId: options.productId,
      });
    }

    if (options.farmerProfileId) {
      qb.andWhere('harvest.farmer_profile_id = :farmerProfileId', {
        farmerProfileId: options.farmerProfileId,
      });
    }

    const harvests = await qb.orderBy('harvest.createdAt', 'DESC').getMany();

    // Map public views to apply the stock safety margin buffer
    if (options.isPublicView) {
      return harvests.map((h) => {
        h.quantityInStock = Math.max(
          0,
          Number(h.quantityInStock) - Number(h.stockMarge),
        );
        return h;
      });
    }

    return harvests;
  }

  async verifyHarvest(
    id: string,
    inspectorId: string,
    dto: VerifyHarvestDto,
  ): Promise<HarvestEntity> {
    const harvest = await this.harvestRepository.findOne({ where: { id } });
    if (!harvest) {
      throw new NotFoundException(`Harvest batch with ID "${id}" not found.`);
    }

    if (harvest.status === HarvestStatus.ARCHIVED) {
      throw new BadRequestException('Cannot verify an archived harvest.');
    }

    harvest.status = dto.status;
    harvest.approvedById = inspectorId;
    harvest.approvedAt = new Date();

    if (dto.status === HarvestStatus.APPROVED) {
      harvest.qualityScore = dto.qualityScore ?? null;
      harvest.rejectionReason = null;
    } else {
      harvest.qualityScore = null;
      harvest.rejectionReason =
        dto.rejectionReason ?? 'Rejected by inspector without comments.';
    }

    return this.harvestRepository.save(harvest);
  }

  // =============================================================================
  // Price Decay & Dynamic Pricing
  // =============================================================================

  async getDecayedPrice(id: string): Promise<{
    basePrice: number;
    decayedPrice: number;
    multiplier: number;
    daysRemaining: number;
  }> {
    const harvest = await this.harvestRepository.findOne({ where: { id } });
    if (!harvest) {
      throw new NotFoundException(`Harvest batch with ID "${id}" not found.`);
    }

    const now = new Date();
    const expiration = new Date(harvest.expirationDate);
    const diffTime = expiration.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let multiplier = 1.0;

    if (
      harvest.priceDecayConfig?.decaySteps &&
      harvest.priceDecayConfig.decaySteps.length > 0
    ) {
      // Sort decay steps ascending by daysBeforeExpiration to locate the correct tier
      const sortedSteps = [...harvest.priceDecayConfig.decaySteps].sort(
        (a, b) => a.daysBeforeExpiration - b.daysBeforeExpiration,
      );
      // Find the first step where remaining days are less than or equal to the tier limit
      const matchingStep = sortedSteps.find(
        (step) => diffDays <= step.daysBeforeExpiration,
      );
      if (matchingStep) {
        multiplier = matchingStep.priceMultiplier;
      }
    }

    const basePrice = Number(harvest.pricePerUnit);
    const decayedPrice = Number((basePrice * multiplier).toFixed(2));

    return {
      basePrice,
      decayedPrice,
      multiplier,
      daysRemaining: diffDays,
    };
  }

  // =============================================================================
  // AI Suggestions (Gemini)
  // =============================================================================

  async aiSuggest(prompt: string): Promise<AiSuggestHarvestResponseDto> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'Gemini API key is not configured.',
      );
    }

    const promptText = `Analyze this description of a crop harvest: "${prompt}". Return a JSON object matching this schema:
{
  "suggestedName": string (e.g. "Medjool Dates" or "Organic Roma Tomatoes"),
  "category": string (must be one of: "CEREALS", "FRUITS", "VEGETABLES", "DATES", "DAIRY", "MEAT", "OTHER"),
  "description": string (detailed description of the product/crop),
  "farmingMethods": string (inferred farming methods),
  "recommendedShelfLifeDays": number (integer representing recommended shelf life in days)
}
Respond ONLY with the JSON object. Do not include markdown code block formatting or any other text.`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: promptText,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Gemini API error status ${response.status}: ${errorText}`,
        );
      }

      interface GeminiResponse {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      }

      const responseData = (await response.json()) as GeminiResponse;
      const textContent =
        responseData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textContent) {
        throw new Error('Gemini returned an empty text content.');
      }

      // Safe parse
      let cleanText: string = textContent.trim();
      if (cleanText.startsWith('```')) {
        const lines: string[] = cleanText.split('\n');
        if (lines.length > 0 && lines[0]?.startsWith('```')) {
          lines.shift();
        }
        if (lines.length > 0 && lines[lines.length - 1]?.startsWith('```')) {
          lines.pop();
        }
        cleanText = lines.join('\n').trim();
      }

      const result = JSON.parse(
        cleanText,
      ) as unknown as AiSuggestHarvestResponseDto;

      // Validate category field
      if (!Object.values(ProductCategory).includes(result.category)) {
        result.category = ProductCategory.OTHER;
      }

      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Failed to generate suggestion: ${errMsg}`);
    }
  }
}
