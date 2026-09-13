import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  AuctionStatus,
  BidStatus,
  CreateAuctionDto,
  UpdateAuctionDto,
  NotificationChannel,
  NotificationPriority,
  PaginatedResult,
} from '@futurefarm/types';
import { AuctionEntity } from './entities/auction.entity';
import { BidEntity } from './entities/bid.entity';
import { HarvestEntity } from '../products/entities/harvest.entity';
import { FarmerProfileEntity } from '../users/entities/farmer-profile.entity';
import { UserEntity } from '../users/entities/user.entity';
import { HarvestStatus } from '@futurefarm/types';
import { AuctionsGateway } from './auctions.gateway';
import { OrdersService } from '../orders/orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StripePaymentGateway } from '../orders/adapters/stripe.adapter';
import { StorageService } from '../storage/storage.service';
import { PlaceBidDto } from './dto/place-bid.dto';
import { Optional } from '@nestjs/common';

@Injectable()
export class AuctionsService {
  private readonly logger = new Logger(AuctionsService.name);

  constructor(
    @InjectRepository(AuctionEntity)
    private readonly auctionRepository: Repository<AuctionEntity>,
    @InjectRepository(BidEntity)
    private readonly bidRepository: Repository<BidEntity>,
    @InjectRepository(HarvestEntity)
    private readonly harvestRepository: Repository<HarvestEntity>,
    @InjectRepository(FarmerProfileEntity)
    private readonly farmerProfileRepository: Repository<FarmerProfileEntity>,
    private readonly dataSource: DataSource,
    private readonly auctionsGateway: AuctionsGateway,
    private readonly ordersService: OrdersService,
    private readonly notificationsService: NotificationsService,
    private readonly stripePaymentGateway: StripePaymentGateway,
    @Optional()
    private readonly storageService?: StorageService,
  ) {}

  /**
   * Hydrates auction harvest photo URLs and farmer avatars with valid signed URLs
   */
  private async hydrateAuction(auction: AuctionEntity): Promise<AuctionEntity> {
    if (!auction || !this.storageService) return auction;
    if (
      auction.harvest?.photoUrls &&
      Array.isArray(auction.harvest.photoUrls) &&
      auction.harvest.photoUrls.length > 0
    ) {
      auction.harvest.photoUrls = await Promise.all(
        auction.harvest.photoUrls.map((p) => this.storageService!.getSignedUrl(p)),
      );
    }
    if (auction.farmerProfile?.avatarUrl) {
      auction.farmerProfile.avatarUrl = await this.storageService.getSignedUrl(
        auction.farmerProfile.avatarUrl,
      );
    }
    if (auction.farmerProfile?.bannerUrl) {
      auction.farmerProfile.bannerUrl = await this.storageService.getSignedUrl(
        auction.farmerProfile.bannerUrl,
      );
    }
    if (auction.farmerProfile?.user?.avatarUrl) {
      auction.farmerProfile.user.avatarUrl = await this.storageService.getSignedUrl(
        auction.farmerProfile.user.avatarUrl,
      );
    }
    return auction;
  }

  private async hydrateAuctions(auctions: AuctionEntity[]): Promise<AuctionEntity[]> {
    if (!auctions || !this.storageService) return auctions;
    return Promise.all(auctions.map((a) => this.hydrateAuction(a)));
  }

  async createAuction(
    userId: string,
    dto: CreateAuctionDto,
    options?: { onBehalfOfUserId?: string },
  ): Promise<AuctionEntity> {
    const targetUserId = options?.onBehalfOfUserId ?? userId;
    const farmerProfile = await this.farmerProfileRepository.findOne({
      where: { userId: targetUserId },
    });
    if (!farmerProfile) {
      throw new ForbiddenException('User does not have a farmer profile');
    }

    const harvest = await this.harvestRepository.findOne({
      where: { id: dto.harvestId },
    });
    if (!harvest) {
      throw new NotFoundException('Harvest not found');
    }

    // Ownership check (bypassed if onBehalfOfUserId matches harvest.farmerProfileId owner user ID)
    if (harvest.farmerProfileId !== farmerProfile.id) {
      throw new ForbiddenException(
        'You can only create auctions for the farmer\'s harvests',
      );
    }

    // Approval status check
    if (harvest.status !== HarvestStatus.APPROVED) {
      throw new ConflictException(
        'Only approved harvests can be put up for auction',
      );
    }

    // Validation checks
    if (dto.startingPrice <= dto.reservePrice) {
      throw new BadRequestException(
        'Starting price must be greater than reserve price',
      );
    }

    const effectiveStock =
      Number(harvest.quantityInStock) - Number(harvest.stockMarge);
    if (dto.quantityOnOffer > effectiveStock) {
      throw new BadRequestException(
        `Quantity on offer (${dto.quantityOnOffer}) exceeds effective stock (${effectiveStock})`,
      );
    }

    // Single active/scheduled auction constraint check
    const existingActive = await this.auctionRepository.findOne({
      where: [
        { harvestId: dto.harvestId, status: AuctionStatus.ACTIVE },
        { harvestId: dto.harvestId, status: AuctionStatus.SCHEDULED },
      ],
    });
    if (existingActive) {
      throw new ConflictException(
        'An active or scheduled auction already exists for this harvest',
      );
    }

    const start = new Date(dto.startAt);
    const end = new Date(dto.endAt);
    const now = new Date();

    if (start >= end) {
      throw new BadRequestException('Start date must be before end date');
    }
    if (end <= now) {
      throw new BadRequestException('End date must be in the future');
    }

    // Deduct stock immediately to reserve it
    harvest.quantityInStock =
      Number(harvest.quantityInStock) - dto.quantityOnOffer;
    await this.harvestRepository.save(harvest);

    const status =
      start <= now ? AuctionStatus.ACTIVE : AuctionStatus.SCHEDULED;

    const auction = new AuctionEntity();
    auction.harvestId = dto.harvestId;
    auction.farmerProfileId = farmerProfile.id;
    auction.status = status;
    auction.startingPrice = dto.startingPrice;
    auction.reservePrice = dto.reservePrice;
    auction.currentPrice = dto.startingPrice;
    auction.priceDecrementAmount = dto.priceDecrementAmount;
    auction.priceDecrementIntervalMinutes = dto.priceDecrementIntervalMinutes;
    auction.quantityOnOffer = dto.quantityOnOffer;
    auction.currency = harvest.currency || 'CDF';
    auction.exchangeRate = harvest.exchangeRate || 2300.0;
    auction.startAt = start;
    auction.endAt = end;
    // Set first tick time
    auction.nextDecrementAt = new Date(
      start.getTime() + dto.priceDecrementIntervalMinutes * 60000,
    );

    const saved = await this.auctionRepository.save(auction);
    return this.hydrateAuction(saved);
  }

  async placeBid(
    userId: string,
    auctionId: string,
    dto?: PlaceBidDto,
  ): Promise<BidEntity> {
    // Run in a serializable transaction to prevent race conditions on bids
    return this.dataSource.transaction(
      'SERIALIZABLE',
      async (transactionalEntityManager) => {
        const auction = await transactionalEntityManager.findOne(
          AuctionEntity,
          {
            where: { id: auctionId },
            lock: { mode: 'pessimistic_write' },
          },
        );

        if (!auction) {
          throw new NotFoundException('Auction not found');
        }

        if (auction.status !== AuctionStatus.ACTIVE) {
          throw new ConflictException('Auction is not active');
        }

        const farmerProfile = await transactionalEntityManager.findOne(
          FarmerProfileEntity,
          {
            where: { id: auction.farmerProfileId },
          },
        );

        if (farmerProfile && farmerProfile.userId === userId) {
          throw new ConflictException(
            'You cannot place a bid on your own auction',
          );
        }

        // Verify user has a saved payment method
        const buyer = await transactionalEntityManager.findOne(UserEntity, {
          where: { id: userId },
        });
        if (!buyer || !buyer.stripePaymentMethodId || !buyer.stripeCustomerId) {
          throw new BadRequestException(
            'Un moyen de paiement enregistré (carte bancaire) est requis pour participer aux enchères.',
          );
        }

        const now = new Date();

        // 1. AUTO-BID CASE: User set a target price lower than current price
        if (
          dto?.autoBidMaxPrice !== undefined &&
          Number(dto.autoBidMaxPrice) < Number(auction.currentPrice)
        ) {
          const autoBidPrice = Number(dto.autoBidMaxPrice);
          if (autoBidPrice < Number(auction.reservePrice)) {
            throw new BadRequestException(
              `Le prix d'offre automatique (${autoBidPrice}) ne peut pas être inférieur au prix de réserve (${auction.reservePrice}).`,
            );
          }

          // Check if buyer already has a pending auto-bid for this auction
          let existingBid = await transactionalEntityManager.findOne(BidEntity, {
            where: {
              auctionId: auction.id,
              buyerId: userId,
              status: BidStatus.PENDING,
            },
          });

          if (existingBid) {
            existingBid.autoBidMaxPrice = autoBidPrice;
            existingBid.priceAtBid = autoBidPrice;
            if (dto?.deliveryAddress) {
              existingBid.deliveryAddress = dto.deliveryAddress;
            }
            return transactionalEntityManager.save(BidEntity, existingBid);
          }

          const autoBid = new BidEntity();
          autoBid.auctionId = auction.id;
          autoBid.buyerId = userId;
          autoBid.priceAtBid = autoBidPrice;
          autoBid.autoBidMaxPrice = autoBidPrice;
          autoBid.isAutoBid = true;
          autoBid.quantityWon = auction.quantityOnOffer;
          autoBid.currency = auction.currency || 'CDF';
          autoBid.exchangeRate = auction.exchangeRate || 2300.0;
          autoBid.deliveryAddress = dto?.deliveryAddress || null;
          autoBid.status = BidStatus.PENDING;

          return transactionalEntityManager.save(BidEntity, autoBid);
        }

        // 2. IMMEDIATE BUY CASE: Buy at current price
        const currency = auction.currency || buyer?.preferredCurrency || 'CDF';
        const exchangeRate = Number(auction.exchangeRate) || 1.0;
        const totalAmount = Number(auction.currentPrice) * Number(auction.quantityOnOffer);

        // Attempt to charge the saved card off-session in the buyer's defined currency
        let paymentIntent: any = null;
        try {
          paymentIntent = await this.stripePaymentGateway.chargeSavedCard({
            customerId: buyer.stripeCustomerId,
            paymentMethodId: buyer.stripePaymentMethodId,
            amount: totalAmount,
            currency: currency,
            description: `Future Farm - Enchère remportée #${auction.id.slice(0, 8)}`,
            metadata: {
              auctionId: auction.id,
              buyerId: userId,
            },
          });
        } catch (error: any) {
          this.logger.error(
            `Payment failed for auction ${auction.id} by buyer ${userId}: ${error.message}`,
          );
          throw new BadRequestException(
            `Échec du prélèvement de la carte enregistrée : ${error.message}`,
          );
        }

        // Create the winning bid
        const bid = new BidEntity();
        bid.auctionId = auction.id;
        bid.buyerId = userId;
        bid.priceAtBid = auction.currentPrice;
        bid.quantityWon = auction.quantityOnOffer;
        bid.currency = currency;
        bid.exchangeRate = exchangeRate;
        bid.deliveryAddress = dto?.deliveryAddress || null;
        bid.status = BidStatus.ACCEPTED;
        bid.isAutoBid = dto?.autoBidMaxPrice !== undefined;
        bid.autoBidMaxPrice = dto?.autoBidMaxPrice ?? null;
        const savedBid = await transactionalEntityManager.save(BidEntity, bid);

        // Generate Order from won auction bid in PENDING_PAYMENT status
        const order = await this.ordersService.createFromBid(
          savedBid,
          auction,
          transactionalEntityManager,
          {
            paymentIntentId: paymentIntent?.id,
            deliveryAddress: dto?.deliveryAddress,
          },
        );
        savedBid.orderId = order.id;
        await transactionalEntityManager.save(BidEntity, savedBid);

        // Mark any other pending auto-bids on this auction as OUTBID
        await transactionalEntityManager
          .createQueryBuilder()
          .update(BidEntity)
          .set({ status: BidStatus.OUTBID })
          .where('auction_id = :auctionId AND status = :status AND id != :bidId', {
            auctionId: auction.id,
            status: BidStatus.PENDING,
            bidId: savedBid.id,
          })
          .execute();

        // Update auction status
        auction.status = AuctionStatus.SOLD;
        auction.soldAt = now;
        auction.winnerId = userId;
        auction.winningBidId = savedBid.id;
        await transactionalEntityManager.save(AuctionEntity, auction);

        // Notify client subscribers via WS
        this.auctionsGateway.emitSold(auction.id, userId, bid.priceAtBid, now);

        // Send multi-channel notification (in-app DB + Email)
        try {
          await this.notificationsService.send({
            recipientIds: [userId],
            title: 'Félicitations ! Enchère remportée',
            body: `Vous avez remporté le lot d'enchère #${auction.id.slice(0, 8)} (${auction.quantityOnOffer} kg) pour un montant de ${totalAmount} ${currency}. Votre carte bancaire a été débitée avec succès.`,
            channels: [NotificationChannel.DATABASE, NotificationChannel.EMAIL],
            priority: NotificationPriority.HIGH,
            metadata: {
              auctionId: auction.id,
              orderId: order.id,
              actionUrl: `/orders/${order.id}`,
              actionText: 'Voir ma commande',
            },
          });
        } catch (notifErr) {
          this.logger.error(
            `Failed to send win notification to user ${userId}:`,
            notifErr,
          );
        }

        return savedBid;
      },
    );
  }

  async cancelAuction(
    userId: string,
    auctionId: string,
    isAdmin: boolean,
    options?: { onBehalfOfUserId?: string },
  ): Promise<AuctionEntity> {
    const auction = await this.auctionRepository.findOne({
      where: { id: auctionId },
    });
    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    if (
      auction.status !== AuctionStatus.SCHEDULED &&
      auction.status !== AuctionStatus.ACTIVE
    ) {
      throw new ConflictException(
        'Only active or scheduled auctions can be cancelled',
      );
    }

    // Check ownership unless admin or proxy request
    const targetUserId = options?.onBehalfOfUserId ?? userId;
    if (!isAdmin) {
      const farmerProfile = await this.farmerProfileRepository.findOne({
        where: { userId: targetUserId },
      });
      if (!farmerProfile || auction.farmerProfileId !== farmerProfile.id) {
        throw new ForbiddenException(
          'You are not authorized to cancel this auction',
        );
      }
    }

    auction.status = AuctionStatus.CANCELLED;
    const savedAuction = await this.auctionRepository.save(auction);

    // Refund stock to harvest
    const harvest = await this.harvestRepository.findOne({
      where: { id: auction.harvestId },
    });
    if (harvest) {
      harvest.quantityInStock =
        Number(harvest.quantityInStock) + Number(auction.quantityOnOffer);
      await this.harvestRepository.save(harvest);
    }

    this.auctionsGateway.emitCancelled(auction.id);

    return savedAuction;
  }

  async updateAuction(
    userId: string,
    auctionId: string,
    dto: UpdateAuctionDto,
    options?: { onBehalfOfUserId?: string },
  ): Promise<AuctionEntity> {
    const auction = await this.auctionRepository.findOne({
      where: { id: auctionId },
      relations: ['harvest'],
    });
    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    if (auction.status !== AuctionStatus.SCHEDULED) {
      throw new ConflictException('Only scheduled auctions can be updated');
    }

    const targetUserId = options?.onBehalfOfUserId ?? userId;
    const farmerProfile = await this.farmerProfileRepository.findOne({
      where: { userId: targetUserId },
    });
    if (!farmerProfile || auction.farmerProfileId !== farmerProfile.id) {
      throw new ForbiddenException(
        'You are not authorized to update this auction',
      );
    }

    const start = dto.startAt ? new Date(dto.startAt) : auction.startAt;
    const end = dto.endAt ? new Date(dto.endAt) : auction.endAt;
    const startingPrice =
      dto.startingPrice !== undefined
        ? dto.startingPrice
        : auction.startingPrice;
    const reservePrice =
      dto.reservePrice !== undefined ? dto.reservePrice : auction.reservePrice;

    if (start >= end) {
      throw new BadRequestException('Start date must be before end date');
    }
    if (startingPrice <= reservePrice) {
      throw new BadRequestException(
        'Starting price must be greater than reserve price',
      );
    }

    if (dto.startingPrice !== undefined) {
      auction.startingPrice = dto.startingPrice;
      auction.currentPrice = dto.startingPrice;
    }
    if (dto.reservePrice !== undefined) {
      auction.reservePrice = dto.reservePrice;
    }
    if (dto.priceDecrementAmount !== undefined) {
      auction.priceDecrementAmount = dto.priceDecrementAmount;
    }
    if (dto.priceDecrementIntervalMinutes !== undefined) {
      auction.priceDecrementIntervalMinutes = dto.priceDecrementIntervalMinutes;
    }
    if (dto.startAt !== undefined) {
      auction.startAt = start;
      // Re-calculate first tick time
      auction.nextDecrementAt = new Date(
        start.getTime() + auction.priceDecrementIntervalMinutes * 60000,
      );
    }
    if (dto.endAt !== undefined) {
      auction.endAt = end;
    }

    const saved = await this.auctionRepository.save(auction);
    return this.hydrateAuction(saved);
  }

  async getAuction(auctionId: string): Promise<AuctionEntity> {
    const auction = await this.auctionRepository.findOne({
      where: { id: auctionId },
      relations: [
        'harvest',
        'harvest.product',
        'farmerProfile',
        'farmerProfile.user',
        'winner',
        'winningBid',
      ],
    });
    if (!auction) {
      throw new NotFoundException('Auction not found');
    }
    return this.hydrateAuction(auction);
  }

  async listAuctions(options: {
    status?: AuctionStatus | undefined;
    harvestId?: string | undefined;
    farmerProfileId?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  }): Promise<PaginatedResult<AuctionEntity>> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.auctionRepository.createQueryBuilder('auction');
    qb.leftJoinAndSelect('auction.harvest', 'harvest')
      .leftJoinAndSelect('harvest.product', 'product')
      .leftJoinAndSelect('auction.farmerProfile', 'farmerProfile')
      .leftJoinAndSelect('farmerProfile.user', 'farmerUser');

    if (options.status) {
      qb.andWhere('auction.status = :status', { status: options.status });
    }
    if (options.harvestId) {
      qb.andWhere('auction.harvest_id = :harvestId', {
        harvestId: options.harvestId,
      });
    }
    if (options.farmerProfileId) {
      qb.andWhere('auction.farmer_profile_id = :farmerProfileId', {
        farmerProfileId: options.farmerProfileId,
      });
    }

    qb.orderBy('auction.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    const hydratedData = await this.hydrateAuctions(data);

    return {
      data: hydratedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async listFarmerAuctions(
    userId: string,
    options: {
      status?: AuctionStatus | undefined;
      page?: number | undefined;
      limit?: number | undefined;
    },
  ): Promise<PaginatedResult<AuctionEntity>> {
    const profile = await this.farmerProfileRepository.findOne({
      where: { userId },
    });
    if (!profile) {
      return {
        data: [],
        meta: {
          total: 0,
          page: options.page || 1,
          limit: options.limit || 20,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }
    return this.listAuctions({
      ...options,
      farmerProfileId: profile.id,
    });
  }

  async listMyBids(userId: string): Promise<BidEntity[]> {
    return this.bidRepository.find({
      where: { buyerId: userId },
      relations: ['auction', 'auction.harvest', 'auction.harvest.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async cancelBid(userId: string, auctionId: string): Promise<BidEntity> {
    const auction = await this.auctionRepository.findOne({
      where: { id: auctionId },
    });

    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    if (auction.status !== AuctionStatus.ACTIVE) {
      throw new ConflictException('Auction is not active');
    }

    const bid = await this.bidRepository.findOne({
      where: { auctionId, buyerId: userId },
    });

    if (!bid) {
      throw new NotFoundException('No bid found for this auction');
    }

    if (bid.status === BidStatus.CANCELLED) {
      throw new ConflictException('Bid is already cancelled');
    }

    bid.status = BidStatus.CANCELLED;
    return this.bidRepository.save(bid);
  }

  async listAllBidsForAdmin(auctionId: string): Promise<BidEntity[]> {
    return this.bidRepository.find({
      where: { auctionId },
      relations: ['buyer'],
      order: { createdAt: 'DESC' },
    });
  }
}
