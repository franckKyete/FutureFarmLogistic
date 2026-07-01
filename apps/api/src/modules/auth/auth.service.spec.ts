/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from '../users/entities/user.entity';
import { UserSessionEntity } from './entities/user-session.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { UserStatus, NotificationChannel } from '@futurefarm/types';

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: any;
  let sessionRepository: any;
  let jwtService: any;
  let configService: any;
  let notificationsService: any;

  const mockUsersRepository = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockSessionRepository = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockNotificationsService = {
    send: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUsersRepository,
        },
        {
          provide: getRepositoryToken(UserSessionEntity),
          useValue: mockSessionRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersRepository = module.get(getRepositoryToken(UserEntity));
    sessionRepository = module.get(getRepositoryToken(UserSessionEntity));
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    notificationsService = module.get(NotificationsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'password123' };

    it('should throw UnauthorizedException if user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password validation fails', async () => {
      const mockUser = {
        validatePassword: jest.fn().mockResolvedValue(false),
        isActive: true,
      };
      usersRepository.findOne.mockResolvedValue(mockUser);
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw ForbiddenException if user status is PENDING_VALIDATION', async () => {
      const mockUser = {
        validatePassword: jest.fn().mockResolvedValue(true),
        isActive: true,
        status: UserStatus.PENDING_VALIDATION,
      };
      usersRepository.findOne.mockResolvedValue(mockUser);
      await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
    });

    it('should return require2fa: true and a temporary token if 2FA is enabled', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        validatePassword: jest.fn().mockResolvedValue(true),
        isActive: true,
        status: UserStatus.APPROVED,
        isTwoFactorEnabled: true,
      };
      usersRepository.findOne.mockResolvedValue(mockUser);
      jwtService.signAsync.mockResolvedValue('temp-jwt-token');

      const result = await service.login(loginDto);
      expect(result).toEqual({ require2fa: true, tempToken: 'temp-jwt-token' });
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 'user-id', isTemp: true },
        { expiresIn: '5m' },
      );
    });

    it('should return tokens and user profile if login is successful and 2FA is disabled', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        validatePassword: jest.fn().mockResolvedValue(true),
        isActive: true,
        status: UserStatus.APPROVED,
        isTwoFactorEnabled: false,
        roles: [{ name: 'Farmer', permissions: ['parcel:create'] }],
      };
      usersRepository.findOne.mockResolvedValue(mockUser);
      jwtService.signAsync.mockResolvedValueOnce('access-token');
      jwtService.signAsync.mockResolvedValueOnce('refresh-token');
      configService.get.mockImplementation((_: string, def: unknown) => def);
      sessionRepository.save.mockResolvedValue({});

      const result = await service.login(loginDto, 'user-agent', '127.0.0.1');

      expect(result.require2fa).toBe(false);
      if (result.require2fa === false) {
        expect(result.tokens).toEqual({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        });
        expect(result.user.email).toBe('test@example.com');
      }
      expect(sessionRepository.save).toHaveBeenCalled();
    });
  });

  describe('2FA flows', () => {
    describe('authenticate2fa', () => {
      it('should throw UnauthorizedException if temp token is invalid', async () => {
        jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));
        await expect(
          service.authenticate2fa('bad-token', '123456'),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('should authenticate and return tokens if code is valid', async () => {
        jwtService.verifyAsync.mockResolvedValue({
          sub: 'user-id',
          isTemp: true,
        });
        const mockUser = {
          id: 'user-id',
          email: 'test@example.com',
          isActive: true,
          status: UserStatus.APPROVED,
          isTwoFactorEnabled: true,
          twoFactorSecret: 'MFASECRET',
          roles: [],
        };
        usersRepository.findOne.mockResolvedValue(mockUser);

        // Mock TOTP verification
        jest
          .spyOn((service as any).totp, 'verify')
          .mockResolvedValue({ valid: true });

        jwtService.signAsync.mockResolvedValueOnce('access-token');
        jwtService.signAsync.mockResolvedValueOnce('refresh-token');

        const result = await service.authenticate2fa('temp-token', '123456');
        expect(result.tokens).toEqual({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        });
      });
    });

    describe('generate2faSecret', () => {
      it('should generate a secret and QR code URL', async () => {
        usersRepository.findOneBy.mockResolvedValue({
          id: 'user-id',
          email: 'test@example.com',
        });
        jest
          .spyOn((service as any).totp, 'generateSecret')
          .mockReturnValue('MFASECRET');
        jest
          .spyOn((service as any).totp, 'toURI')
          .mockReturnValue('otpauth://...');

        const result = await service.generate2faSecret('user-id');
        expect(result.secret).toBe('MFASECRET');
        expect(result.qrCodeUrl).toBeDefined();
      });
    });

    describe('enable2fa', () => {
      it('should enable 2FA if code is valid', async () => {
        jest
          .spyOn((service as any).totp, 'verify')
          .mockResolvedValue({ valid: true });
        usersRepository.update.mockResolvedValue({});

        await service.enable2fa('user-id', '123456', 'SECRET');
        expect(usersRepository.update).toHaveBeenCalledWith(
          { id: 'user-id' },
          { twoFactorSecret: 'SECRET', isTwoFactorEnabled: true },
        );
      });

      it('should throw BadRequestException if code is invalid', async () => {
        jest
          .spyOn((service as any).totp, 'verify')
          .mockResolvedValue({ valid: false });
        await expect(
          service.enable2fa('user-id', '123456', 'SECRET'),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('password recovery', () => {
    describe('forgotPassword', () => {
      it('should silently return if user not found', async () => {
        usersRepository.findOneBy.mockResolvedValue(null);
        await expect(
          service.forgotPassword('none@example.com'),
        ).resolves.not.toThrow();
        expect(notificationsService.send).not.toHaveBeenCalled();
      });

      it('should generate token and send recovery email if user exists', async () => {
        const mockUser = { id: 'user-id', email: 'test@example.com' };
        usersRepository.findOneBy.mockResolvedValue(mockUser);
        usersRepository.update.mockResolvedValue({});
        configService.get.mockReturnValue('http://localhost:3001');

        await service.forgotPassword('test@example.com');
        expect(usersRepository.update).toHaveBeenCalled();
        expect(notificationsService.send).toHaveBeenCalledWith(
          expect.objectContaining({
            recipientIds: ['user-id'],
            channels: [NotificationChannel.EMAIL],
          }),
        );
      });
    });

    describe('resetPassword', () => {
      it('should throw BadRequestException if token is invalid or expired', async () => {
        usersRepository.findOne.mockResolvedValue(null);
        await expect(
          service.resetPassword('bad-token', 'newPass123'),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reset password successfully', async () => {
        const mockUser = {
          id: 'user-id',
          resetPasswordExpires: new Date(Date.now() + 60000),
        };
        usersRepository.findOne.mockResolvedValue(mockUser);
        usersRepository.findOneBy.mockResolvedValue(mockUser);
        usersRepository.save.mockResolvedValue({});

        await service.resetPassword('good-token', 'newPass123');
        expect(usersRepository.save).toHaveBeenCalled();
      });
    });
  });

  describe('sessions', () => {
    it('should list sessions', async () => {
      sessionRepository.find.mockResolvedValue([]);
      const result = await service.getSessions('user-id');
      expect(result).toEqual([]);
    });

    it('should revoke session', async () => {
      const mockSession = {
        id: 'session-id',
        userId: 'user-id',
        isRevoked: false,
      };
      sessionRepository.findOneBy.mockResolvedValue(mockSession);
      sessionRepository.save.mockResolvedValue({});

      await service.revokeSession('user-id', 'session-id');
      expect(mockSession.isRevoked).toBe(true);
      expect(sessionRepository.save).toHaveBeenCalledWith(mockSession);
    });
  });
});
