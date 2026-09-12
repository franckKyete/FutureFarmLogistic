import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { AuctionEvent } from '@futurefarm/types';

@WebSocketGateway({
  namespace: 'auctions',
  cors: {
    origin: '*',
  },
})
export class AuctionsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(AuctionsGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_auction')
  handleJoinAuction(
    @MessageBody() data: { auctionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data && data.auctionId) {
      const room = `auction:${data.auctionId}`;
      void client.join(room);
      this.logger.log(`Client ${client.id} joined room ${room}`);
      return { status: 'joined', room };
    }
    return { status: 'error', message: 'Invalid auctionId' };
  }

  @SubscribeMessage('leave_auction')
  handleLeaveAuction(
    @MessageBody() data: { auctionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data && data.auctionId) {
      const room = `auction:${data.auctionId}`;
      void client.leave(room);
      this.logger.log(`Client ${client.id} left room ${room}`);
      return { status: 'left', room };
    }
    return { status: 'error', message: 'Invalid auctionId' };
  }

  emitPriceTick(
    auctionId: string,
    currentPrice: number,
    nextDecrementAt: Date,
  ) {
    const room = `auction:${auctionId}`;
    const payload = {
      auctionId,
      currentPrice,
      nextDecrementAt: nextDecrementAt.toISOString(),
    };
    this.server.to(room).emit(AuctionEvent.PRICE_TICK, payload);
    this.server.emit(AuctionEvent.PRICE_TICK, payload);
  }

  emitSold(
    auctionId: string,
    winnerId: string,
    priceAtBid: number,
    soldAt: Date,
  ) {
    const room = `auction:${auctionId}`;
    const payload = {
      auctionId,
      winnerId,
      priceAtBid,
      soldAt: soldAt.toISOString(),
    };
    this.server.to(room).emit(AuctionEvent.AUCTION_SOLD, payload);
    this.server.emit(AuctionEvent.AUCTION_SOLD, payload);
  }

  emitExpired(auctionId: string, reason: 'DEADLINE' | 'FLOOR_PRICE') {
    const room = `auction:${auctionId}`;
    const payload = {
      auctionId,
      reason,
    };
    this.server.to(room).emit(AuctionEvent.AUCTION_EXPIRED, payload);
    this.server.emit(AuctionEvent.AUCTION_EXPIRED, payload);
  }

  emitCancelled(auctionId: string) {
    const room = `auction:${auctionId}`;
    const payload = {
      auctionId,
    };
    this.server.to(room).emit(AuctionEvent.AUCTION_CANCELLED, payload);
    this.server.emit(AuctionEvent.AUCTION_CANCELLED, payload);
  }
}
