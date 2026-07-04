import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  AuctionStatus,
  BidStatus,
  CreateAuctionDto,
  UpdateAuctionDto,
  PaginatedResult,
} from '@futurefarm/types';
import { AuctionEntity } from './entities/auction.entity';
import { BidEntity } from './entities/bid.entity';
import { HarvestEntity } from '../products/entities/harvest.entity';
import { FarmerProfileEntity } from '../users/entities/farmer-profile.entity';
import { HarvestStatus } from '@futurefarm/types';
import { AuctionsGateway } from './auctions.gateway';

@Injectable()
export class AuctionsService {
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
  ) {}

  async createAuction(
    userId: string,
    dto: CreateAuctionDto,
  ): Promise<AuctionEntity> {
    const farmerProfile = await this.farmerProfileRepository.findOne({
      where: { userId },
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

    // Ownership check
    if (harvest.farmerProfileId !== farmerProfile.id) {
      throw new ForbiddenException(
        'You can only create auctions for your own harvests',
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
    auction.startAt = start;
    auction.endAt = end;
    // Set first tick time
    auction.nextDecrementAt = new Date(
      start.getTime() + dto.priceDecrementIntervalMinutes * 60000,
    );

    return this.auctionRepository.save(auction);
  }

  async placeBid(userId: string, auctionId: string): Promise<BidEntity> {
    // Run in a serializable transaction to prevent race conditions on bids
    return this.dataSource.transaction(
      'SERIALIZABLE',
      async (transactionalEntityManager) => {
        const auction = await transactionalEntityManager.findOne(
          AuctionEntity,
          {
            where: { id: auctionId },
            lock: { mode: 'pessimistic_write' },
            relations: ['farmerProfile'],
          },
        );

        if (!auction) {
          throw new NotFoundException('Auction not found');
        }

        if (auction.status !== AuctionStatus.ACTIVE) {
          throw new ConflictException('Auction is not active');
        }

        if (auction.farmerProfile.userId === userId) {
          throw new ConflictException(
            'You cannot place a bid on your own auction',
          );
        }

        const now = new Date();

        // Create the bid
        const bid = new BidEntity();
        bid.auctionId = auction.id;
        bid.buyerId = userId;
        bid.priceAtBid = auction.currentPrice;
        bid.quantityWon = auction.quantityOnOffer;
        bid.status = BidStatus.ACCEPTED;
        const savedBid = await transactionalEntityManager.save(bid);

        // Update auction status
        auction.status = AuctionStatus.SOLD;
        auction.soldAt = now;
        auction.winnerId = userId;
        auction.winningBidId = savedBid.id;
        await transactionalEntityManager.save(auction);

        // Notify client subscribers via WS
        this.auctionsGateway.emitSold(auction.id, userId, bid.priceAtBid, now);

        return savedBid;
      },
    );
  }

  async cancelAuction(
    userId: string,
    auctionId: string,
    isAdmin: boolean,
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

    // Check ownership unless admin
    if (!isAdmin) {
      const farmerProfile = await this.farmerProfileRepository.findOne({
        where: { userId },
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

    const farmerProfile = await this.farmerProfileRepository.findOne({
      where: { userId },
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

    return this.auctionRepository.save(auction);
  }

  async getAuction(auctionId: string): Promise<AuctionEntity> {
    const auction = await this.auctionRepository.findOne({
      where: { id: auctionId },
      relations: [
        'harvest',
        'harvest.product',
        'farmerProfile',
        'winner',
        'winningBid',
      ],
    });
    if (!auction) {
      throw new NotFoundException('Auction not found');
    }
    return auction;
  }

  async listAuctions(options: {
    status?: AuctionStatus | undefined;
    harvestId?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  }): Promise<PaginatedResult<AuctionEntity>> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.auctionRepository.createQueryBuilder('auction');
    qb.leftJoinAndSelect('auction.harvest', 'harvest')
      .leftJoinAndSelect('harvest.product', 'product')
      .leftJoinAndSelect('auction.farmerProfile', 'farmerProfile');

    if (options.status) {
      qb.andWhere('auction.status = :status', { status: options.status });
    }
    if (options.harvestId) {
      qb.andWhere('auction.harvest_id = :harvestId', {
        harvestId: options.harvestId,
      });
    }

    qb.orderBy('auction.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
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

  async listMyBids(userId: string): Promise<BidEntity[]> {
    return this.bidRepository.find({
      where: { buyerId: userId },
      relations: ['auction', 'auction.harvest', 'auction.harvest.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async listAllBidsForAdmin(auctionId: string): Promise<BidEntity[]> {
    return this.bidRepository.find({
      where: { auctionId },
      relations: ['buyer'],
      order: { createdAt: 'DESC' },
    });
  }
}
