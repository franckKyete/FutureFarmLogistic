/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { NotificationsGateway } from './notifications.gateway';
import { Socket, Server } from 'socket.io';

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;

  const mockSocket = {
    id: 'socket-id',
    handshake: {
      auth: { token: 'mock-token' },
    },
    disconnect: jest.fn(),
    join: jest.fn(() => Promise.resolve()),
    data: {},
  } as unknown as Socket;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  } as unknown as Server;

  const mockJwtService = {
    verify: jest.fn(() => ({ sub: 'user-1' })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsGateway,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    gateway = module.get<NotificationsGateway>(NotificationsGateway);
    gateway.server = mockServer;

    jest.clearAllMocks();
    mockSocket.data = {};
  });

  describe('handleConnection', () => {
    it('should disconnect client if no token provided', async () => {
      const socketNoToken = {
        id: 'socket-2',
        handshake: { auth: {} },
        disconnect: jest.fn(),
      } as unknown as Socket;

      await gateway.handleConnection(socketNoToken);
      expect(socketNoToken.disconnect).toHaveBeenCalled();
    });

    it('should verify token and authorize user', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-1' });

      await gateway.handleConnection(mockSocket);
      expect(mockSocket.data.userId).toBe('user-1');
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('should disconnect if token verification fails', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await gateway.handleConnection(mockSocket);
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('subscribe and emit', () => {
    it('should subscribe authorized client to room', () => {
      mockSocket.data.userId = 'user-1';
      const res = gateway.handleSubscribe(mockSocket);
      expect(res.status).toBe('subscribed');
      expect(mockSocket.join).toHaveBeenCalledWith('user:user-1');
    });

    it('should disconnect unauthorized client on subscribe request', () => {
      mockSocket.data.userId = undefined;
      const res = gateway.handleSubscribe(mockSocket);
      expect(res.status).toBe('error');
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should emit new notification to correct room', () => {
      const notification = { id: 'notif-1', title: 'New' } as any;
      gateway.emitNewNotification('user-1', notification);
      expect(mockServer.to).toHaveBeenCalledWith('user:user-1');
      expect(mockServer.emit).toHaveBeenCalledWith('notification:new', notification);
    });
  });
});
