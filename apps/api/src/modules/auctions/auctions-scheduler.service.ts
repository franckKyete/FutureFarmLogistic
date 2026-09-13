import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, LessThanOrEqual } from 'typeorm';
import { AuctionEntity } from './entities/auction.entity';
import { BidEntity } from './entities/bid.entity';
import { UserEntity } from '../users/entities/user.entity';
import {
  AuctionStatus,
  BidStatus,
  NotificationChannel,
  NotificationPriority,
} from '@futurefarm/types';
import { AuctionsGateway } from './auctions.gateway';
import { OrdersService } from '../orders/orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StripePaymentGateway } from '../orders/adapters/stripe.adapter';

@Injectable()
export class AuctionsSchedulerService {
  private readonly logger = new Logger(AuctionsSchedulerService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly auctionsGateway: AuctionsGateway,
    private readonly ordersService: OrdersService,
    private readonly notificationsService: NotificationsService,
    private readonly stripePaymentGateway: StripePaymentGateway,
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
        const newPrice = Math.max(targetPrice, Number(auction.reservePrice));

        auction.nextDecrementAt = new Date(
          auction.nextDecrementAt.getTime() +
            totalIntervalsToApply * intervalMs,
        );

        // Check for pending auto-bids that qualify at newPrice
        const pendingAutoBids = await entityManager.find(BidEntity, {
          where: {
            auctionId: auction.id,
            status: BidStatus.PENDING,
          },
          order: {
            autoBidMaxPrice: 'DESC',
            createdAt: 'ASC',
          },
        });

        let autoBidExecuted = false;

        for (const candidateBid of pendingAutoBids) {
          if (
            candidateBid.autoBidMaxPrice !== null &&
            Number(candidateBid.autoBidMaxPrice) >= newPrice
          ) {
            // Find buyer with payment method
            const buyer = await entityManager.findOne(UserEntity, {
              where: { id: candidateBid.buyerId },
            });

            if (buyer && buyer.stripeCustomerId && buyer.stripePaymentMethodId) {
              const currency = auction.currency || buyer.preferredCurrency || 'CDF';
              const exchangeRate = Number(auction.exchangeRate) || 1.0;
              const totalAmount = newPrice * Number(auction.quantityOnOffer);

              try {
                // Charge saved card in the defined currency
                const paymentIntent = await this.stripePaymentGateway.chargeSavedCard({
                  customerId: buyer.stripeCustomerId,
                  paymentMethodId: buyer.stripePaymentMethodId,
                  amount: totalAmount,
                  currency: currency,
                  description: `Future Farm - Offre automatique remportée #${auction.id.slice(0, 8)}`,
                  metadata: {
                    auctionId: auction.id,
                    buyerId: buyer.id,
                  },
                });

                // Auto-bid won!
                candidateBid.status = BidStatus.ACCEPTED;
                candidateBid.priceAtBid = newPrice;
                candidateBid.quantityWon = auction.quantityOnOffer;
                candidateBid.currency = currency;
                candidateBid.exchangeRate = exchangeRate;
                const savedBid = await entityManager.save(BidEntity, candidateBid);

                const order = await this.ordersService.createFromBid(
                  savedBid,
                  auction,
                  entityManager,
                  {
                    paymentIntentId: paymentIntent?.id,
                    deliveryAddress: candidateBid.deliveryAddress,
                  },
                );
                savedBid.orderId = order.id;
                await entityManager.save(BidEntity, savedBid);

                // Mark other pending auto-bids as OUTBID
                await entityManager
                  .createQueryBuilder()
                  .update(BidEntity)
                  .set({ status: BidStatus.OUTBID })
                  .where(
                    'auction_id = :auctionId AND status = :status AND id != :bidId',
                    {
                      auctionId: auction.id,
                      status: BidStatus.PENDING,
                      bidId: savedBid.id,
                    },
                  )
                  .execute();

                auction.status = AuctionStatus.SOLD;
                auction.currentPrice = newPrice;
                auction.soldAt = now;
                auction.winnerId = buyer.id;
                auction.winningBidId = savedBid.id;
                await entityManager.save(AuctionEntity, auction);

                this.auctionsGateway.emitSold(
                  auction.id,
                  buyer.id,
                  newPrice,
                  now,
                );

                try {
                  await this.notificationsService.send({
                    recipientIds: [buyer.id],
                    title: 'Félicitations ! Enchère remportée par offre automatique',
                    body: `Votre offre automatique a remporté le lot d'enchère #${auction.id.slice(0, 8)} (${auction.quantityOnOffer} kg) pour un montant de ${totalAmount} ${currency}. Votre carte bancaire enregistrée a été débitée.`,
                    channels: [
                      NotificationChannel.DATABASE,
                      NotificationChannel.EMAIL,
                    ],
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
                    `Failed to send auto-bid win notification to user ${buyer.id}:`,
                    notifErr,
                  );
                }

                this.logger.log(
                  `Auto-bid won for auction ${auction.id} by buyer ${buyer.id} at price ${newPrice}`,
                );
                autoBidExecuted = true;
                break;
              } catch (chargeErr: any) {
                this.logger.error(
                  `Auto-bid charge failed for buyer ${buyer.id}: ${chargeErr.message}. Cancelling auto-bid.`,
                );
                candidateBid.status = BidStatus.CANCELLED;
                await entityManager.save(BidEntity, candidateBid);
              }
            }
          }
        }

        if (autoBidExecuted) {
          continue;
        }

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
