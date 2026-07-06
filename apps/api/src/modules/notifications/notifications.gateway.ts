import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '@futurefarm/types';
import { NotificationEntity } from './entities/notification.entity';

@WebSocketGateway({
  namespace: 'notifications',
  cors: {
    origin: '*',
  },
})
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      this.logger.debug(`Client ${client.id} disconnected: no token provided.`);
      client.disconnect();
      return;
    }

    try {
      // Verify the JWT token
      const payload = this.jwtService.verify<JwtPayload>(token);
      client.data.userId = payload.sub;
      this.logger.debug(`Client ${client.id} authorized for user ${payload.sub}`);
    } catch (err) {
      this.logger.debug(`Client ${client.id} disconnected: token verification failed.`);
      client.disconnect();
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId as string;
    if (!userId) {
      client.disconnect();
      return { status: 'error', message: 'Unauthorized' };
    }

    const room = `user:${userId}`;
    void client.join(room);
    this.logger.debug(`Client ${client.id} joined notification room ${room}`);
    return { status: 'subscribed', room };
  }

  emitNewNotification(userId: string, notification: NotificationEntity) {
    const room = `user:${userId}`;
    this.server.to(room).emit('notification:new', notification);
    this.logger.debug(`Emitted notification:new to room ${room}`);
  }
}
