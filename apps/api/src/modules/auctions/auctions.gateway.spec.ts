/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { AuctionsGateway } from './auctions.gateway';
import { Socket, Server } from 'socket.io';

describe('AuctionsGateway', () => {
  let gateway: AuctionsGateway;

  const mockSocket = {
    id: 'socket-id',
    join: jest.fn(() => Promise.resolve()),
    leave: jest.fn(() => Promise.resolve()),
  } as unknown as Socket;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  } as unknown as Server;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuctionsGateway],
    }).compile();

    gateway = module.get<AuctionsGateway>(AuctionsGateway);
    gateway.server = mockServer;

    jest.clearAllMocks();
  });

  it('should join and leave rooms', () => {
    const joinRes = gateway.handleJoinAuction({ auctionId: 'auc-1' }, mockSocket);
    expect(joinRes.status).toBe('joined');
    expect(mockSocket.join).toHaveBeenCalledWith('auction:auc-1');

    const leaveRes = gateway.handleLeaveAuction({ auctionId: 'auc-1' }, mockSocket);
    expect(leaveRes.status).toBe('left');
    expect(mockSocket.leave).toHaveBeenCalledWith('auction:auc-1');
  });

  it('should emit price ticks and expiration events to correct rooms', () => {
    gateway.emitPriceTick('auc-1', 90, new Date());
    expect(mockServer.to).toHaveBeenCalledWith('auction:auc-1');
    expect(mockServer.emit).toHaveBeenCalled();

    gateway.emitExpired('auc-1', 'DEADLINE');
    expect(mockServer.to).toHaveBeenCalledWith('auction:auc-1');
  });
});
