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
import { DeliveryRunStatus, DeliveryStopStatus, PushLocationDto } from '@futurefarm/types';

/**
 * Real-time logistics gateway on the /logistics Socket.IO namespace.
 *
 * Rooms follow the pattern `run:<runId>`.
 *
 * ## Client → Server events
 * | Event                  | Payload                                       |
 * |------------------------|-----------------------------------------------|
 * | `join_run`             | `{ runId: string }`                           |
 * | `leave_run`            | `{ runId: string }`                           |
 * | `driver:location:push` | `PushLocationDto` (runId, lat, lon, …)        |
 *
 * ## Server → Client events
 * | Event                    | Payload                                              |
 * |--------------------------|------------------------------------------------------|
 * | `driver:location:update` | `{ driverId, lat, lon, heading }`                    |
 * | `stop:status:update`     | `{ stopId, status, completedAt }`                    |
 * | `run:status:update`      | `{ runId, status }`                                  |
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

  // -------------------------------------------------------------------------
  // Driver location push (WebSocket path)
  // -------------------------------------------------------------------------

  /**
   * Drivers can push GPS pings directly via WebSocket.
   * The service layer is invoked externally for persistence; this handler
   * is a lightweight relay that emits the update immediately.
   */
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

  emitLocationUpdate(
    driverId: string,
    lat:      number,
    lon:      number,
    heading:  number | null,
  ) {
    // Broadcast to all rooms containing this driver's runs
    // In practice the service knows the runId and could scope this further
    this.server.emit('driver:location:update', { driverId, lat, lon, heading });
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
