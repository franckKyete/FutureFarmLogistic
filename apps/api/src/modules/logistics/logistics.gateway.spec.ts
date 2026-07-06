/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { LogisticsGateway } from './logistics.gateway';
import { Socket, Server } from 'socket.io';

describe('LogisticsGateway', () => {
  let gateway: LogisticsGateway;

  const mockSocket = {
    id: 'socket-id',
    join: jest.fn(() => Promise.resolve()),
    leave: jest.fn(() => Promise.resolve()),
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  } as unknown as Socket;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  } as unknown as Server;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LogisticsGateway],
    }).compile();

    gateway = module.get<LogisticsGateway>(LogisticsGateway);
    gateway.server = mockServer;

    jest.clearAllMocks();
  });

  it('should join and leave run rooms', () => {
    const joinRes = gateway.handleJoinRun({ runId: 'run-1' }, mockSocket);
    expect(joinRes.status).toBe('joined');
    expect(mockSocket.join).toHaveBeenCalledWith('run:run-1');

    const leaveRes = gateway.handleLeaveRun({ runId: 'run-1' }, mockSocket);
    expect(leaveRes.status).toBe('left');
    expect(mockSocket.leave).toHaveBeenCalledWith('run:run-1');
  });

  it('should handle driver location push and relay it to the room', () => {
    const dto = { runId: 'run-1', lat: 34, lon: -118, heading: 90 };
    const res = gateway.handleLocationPush(dto, mockSocket);

    expect(res.status).toBe('ok');
    expect(mockSocket.to).toHaveBeenCalledWith('run:run-1');
    expect(mockSocket.emit).toHaveBeenCalledWith('driver:location:update', {
      lat: 34,
      lon: -118,
      heading: 90,
    });
  });

  it('should broadcast run and stop status updates', () => {
    gateway.emitRunStatusUpdate('run-1', 'IN_PROGRESS' as any);
    expect(mockServer.to).toHaveBeenCalledWith('run:run-1');
    expect(mockServer.emit).toHaveBeenCalled();

    gateway.emitStopStatusUpdate('stop-1', 'ARRIVED' as any, null);
    expect(mockServer.emit).toHaveBeenCalled();
  });
});
