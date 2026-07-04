import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, LessThanOrEqual } from 'typeorm';
import { AuctionEntity } from './entities/auction.entity';
import { AuctionStatus } from '@futurefarm/types';
import { AuctionsGateway } from './auctions.gateway';

@Injectable()
export class AuctionsSchedulerService {
  private readonly logger = new Logger(AuctionsSchedulerService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly auctionsGateway: AuctionsGateway,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    this.logger.log('Running auctions scheduler tick...');
    const now = new Date();

    await this.dataSource.transaction('SERIALIZABLE', async (entityManager) => {
      // 1. Activate SCHEDULED auctions that have started
      const scheduledAuctions = await entityManager.find(AuctionEntity, {
        where: {
          status: AuctionStatus.SCHEDULED,
          startAt: LessThanOrEqual(now),
        },
      });

      for (const auction of scheduledAuctions) {
        auction.status = AuctionStatus.ACTIVE;
        // set the next decrement time to startAt + interval
        auction.nextDecrementAt = new Date(
          auction.startAt.getTime() +
            auction.priceDecrementIntervalMinutes * 60000,
        );
        await entityManager.save(auction);
        this.logger.log(`Activated auction ${auction.id}`);
      }

      // 2. Expire ACTIVE auctions that reached endAt deadline
      const deadlineAuctions = await entityManager.find(AuctionEntity, {
        where: {
          status: AuctionStatus.ACTIVE,
          endAt: LessThanOrEqual(now),
        },
        relations: ['harvest'],
      });

      for (const auction of deadlineAuctions) {
        auction.status = AuctionStatus.EXPIRED;
        await entityManager.save(auction);

        // Refund stock to harvest
        const harvest = auction.harvest;
        harvest.quantityInStock =
          Number(harvest.quantityInStock) + Number(auction.quantityOnOffer);
        await entityManager.save(harvest);

        this.auctionsGateway.emitExpired(auction.id, 'DEADLINE');
        this.logger.log(`Expired auction ${auction.id} due to deadline`);
      }

      // 3. Tick active auctions whose price needs to be decremented
      const tickingAuctions = await entityManager.find(AuctionEntity, {
        where: {
          status: AuctionStatus.ACTIVE,
          nextDecrementAt: LessThanOrEqual(now),
        },
        relations: ['harvest'],
      });

      for (const auction of tickingAuctions) {
        const elapsedMs = now.getTime() - auction.nextDecrementAt.getTime();
        const intervalMs = auction.priceDecrementIntervalMinutes * 60000;
        const additionalIntervals = Math.floor(elapsedMs / intervalMs);
        const totalIntervalsToApply = 1 + additionalIntervals;

        const totalDecrement =
          totalIntervalsToApply * Number(auction.priceDecrementAmount);
        const targetPrice = Number(auction.currentPrice) - totalDecrement;

        auction.nextDecrementAt = new Date(
          auction.nextDecrementAt.getTime() +
            totalIntervalsToApply * intervalMs,
        );

        if (targetPrice <= Number(auction.reservePrice)) {
          // Hits or falls below reserve floor price -> EXPIRED
          auction.currentPrice = auction.reservePrice;
          auction.status = AuctionStatus.EXPIRED;
          await entityManager.save(auction);

          // Refund stock
          const harvest = auction.harvest;
          harvest.quantityInStock =
            Number(harvest.quantityInStock) + Number(auction.quantityOnOffer);
          await entityManager.save(harvest);

          this.auctionsGateway.emitExpired(auction.id, 'FLOOR_PRICE');
          this.logger.log(
            `Expired auction ${auction.id} because it reached reserve price ${auction.reservePrice}`,
          );
        } else {
          // Decrement price and keep active
          auction.currentPrice = targetPrice;
          await entityManager.save(auction);

          this.auctionsGateway.emitPriceTick(
            auction.id,
            auction.currentPrice,
            auction.nextDecrementAt,
          );
          this.logger.log(
            `Decremented auction ${auction.id} price to ${auction.currentPrice}`,
          );
        }
      }
    });
  }
}
