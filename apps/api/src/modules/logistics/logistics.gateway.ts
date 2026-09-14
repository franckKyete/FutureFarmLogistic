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
import {
  DeliveryRunStatus,
  DeliveryStopStatus,
  PushLocationDto,
  RunAssignedPayload,
} from '@futurefarm/types';

/**
 * Real-time logistics gateway on the /logistics Socket.IO namespace.
 *
 * Rooms follow the pattern:
 * - `run:<runId>` for run participants and admin high-fidelity tracking
 * - `driver:<driverId>` for driver personal notifications (e.g. dispatch assignment)
 * - `run:order:<orderId>` for security-focused buyer tracking with obfuscated coordinates
 */
@WebSocketGateway({
  namespace: 'logistics',
  cors: { origin: '*' },
})
export class LogisticsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LogisticsGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.log(`[Logistics] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[Logistics] Client disconnected: ${client.id}`);
  }

  // -------------------------------------------------------------------------
  // Room management
  // -------------------------------------------------------------------------

  @SubscribeMessage('join_run')
  handleJoinRun(
    @MessageBody() data: { runId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.runId) return { status: 'error', message: 'Missing runId' };
    const room = `run:${data.runId}`;
    void client.join(room);
    this.logger.log(`Client ${client.id} joined ${room}`);
    return { status: 'joined', room };
  }

  @SubscribeMessage('leave_run')
  handleLeaveRun(
    @MessageBody() data: { runId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.runId) return { status: 'error', message: 'Missing runId' };
    const room = `run:${data.runId}`;
    void client.leave(room);
    this.logger.log(`Client ${client.id} left ${room}`);
    return { status: 'left', room };
  }

  @SubscribeMessage('join_driver')
  handleJoinDriver(
    @MessageBody() data: { driverId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.driverId) return { status: 'error', message: 'Missing driverId' };
    const room = `driver:${data.driverId}`;
    void client.join(room);
    this.logger.log(`Client ${client.id} joined ${room}`);
    return { status: 'joined', room };
  }

  @SubscribeMessage('leave_driver')
  handleLeaveDriver(
    @MessageBody() data: { driverId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.driverId) return { status: 'error', message: 'Missing driverId' };
    const room = `driver:${data.driverId}`;
    void client.leave(room);
    this.logger.log(`Client ${client.id} left ${room}`);
    return { status: 'left', room };
  }

  @SubscribeMessage('join_order_tracking')
  handleJoinOrderTracking(
    @MessageBody() data: { orderId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.orderId) return { status: 'error', message: 'Missing orderId' };
    const room = `run:order:${data.orderId}`;
    void client.join(room);
    this.logger.log(`Client ${client.id} joined ${room}`);
    return { status: 'joined', room };
  }

  @SubscribeMessage('leave_order_tracking')
  handleLeaveOrderTracking(
    @MessageBody() data: { orderId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.orderId) return { status: 'error', message: 'Missing orderId' };
    const room = `run:order:${data.orderId}`;
    void client.leave(room);
    this.logger.log(`Client ${client.id} left ${room}`);
    return { status: 'left', room };
  }

  // -------------------------------------------------------------------------
  // Driver location push (WebSocket path)
  // -------------------------------------------------------------------------

  @SubscribeMessage('driver:location:push')
  handleLocationPush(
    @MessageBody() dto: PushLocationDto,
    @ConnectedSocket() client: Socket,
  ) {
    if (!dto?.runId || dto.lat == null || dto.lon == null) {
      return { status: 'error', message: 'Invalid payload' };
    }
    const room = `run:${dto.runId}`;
    client.to(room).emit('driver:location:update', {
      lat:     dto.lat,
      lon:     dto.lon,
      heading: dto.heading ?? null,
    });
    return { status: 'ok' };
  }

  // -------------------------------------------------------------------------
  // Server-side emission helpers (called by LogisticsService)
  // -------------------------------------------------------------------------

  /**
   * Emits real-time location update with dual-precision:
   * 1. Exact coordinates broadcast to `run:<runId>` (for admin high-fidelity view)
   * 2. Intentionally fuzzy/obfuscated coordinates (~1km grid snap) broadcast to `run:order:<orderId>` (for buyer privacy)
   */
  emitLocationUpdate(
    driverId: string,
    lat:      number,
    lon:      number,
    heading:  number | null,
    runId?:   string | null,
    orderIds?: string[] | null,
  ) {
    // 1. High-fidelity broadcast (exact lat/lon) to run room and global
    if (runId) {
      this.server.to(`run:${runId}`).emit('driver:location:update', {
        driverId,
        lat,
        lon,
        heading,
      });
    } else {
      this.server.emit('driver:location:update', { driverId, lat, lon, heading });
    }

    // 2. Low-fidelity / Obfuscated broadcast to buyer order rooms
    if (orderIds && orderIds.length > 0) {
      // Obfuscate to 2 decimal places (~1.1 km resolution) and omit heading for privacy
      const fuzzyLat = Math.round(lat * 100) / 100;
      const fuzzyLon = Math.round(lon * 100) / 100;

      for (const orderId of orderIds) {
        this.server.to(`run:order:${orderId}`).emit('driver:location:update', {
          driverId,
          lat: fuzzyLat,
          lon: fuzzyLon,
          heading: null,
        });
      }
    }
  }

  emitRunAssigned(driverId: string, payload: RunAssignedPayload) {
    this.server.to(`driver:${driverId}`).emit('run:assigned', payload);
  }

  emitStopStatusUpdate(
    stopId:      string,
    status:      DeliveryStopStatus,
    completedAt: Date | null,
  ) {
    this.server.emit('stop:status:update', {
      stopId,
      status,
      completedAt: completedAt?.toISOString() ?? null,
    });
  }

  emitRunStatusUpdate(runId: string, status: DeliveryRunStatus) {
    const room = `run:${runId}`;
    this.server.to(room).emit('run:status:update', { runId, status });
  }
}
