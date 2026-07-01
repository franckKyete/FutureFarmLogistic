import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib';
import * as qrcode from 'qrcode';
import * as crypto from 'crypto';

import type {
  AuthTokens,
  AuthUser,
  JwtPayload,
  Permission,
} from '@futurefarm/types';
import {
  UserStatus,
  NotificationChannel,
  NotificationPriority,
} from '@futurefarm/types';

import { UserEntity } from '../users/entities/user.entity';
import { UserSessionEntity } from './entities/user-session.entity';
import { NotificationsService } from '../notifications/notifications.service';
import type { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly totp = new TOTP({
    crypto: new NobleCryptoPlugin(),
    base32: new ScureBase32Plugin(),
  });

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(UserSessionEntity)
    private readonly sessionRepository: Repository<UserSessionEntity>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async login(
    dto: LoginDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<
    | { require2fa: false; user: AuthUser; tokens: AuthTokens }
    | { require2fa: true; tempToken: string }
  > {
    const user = await this.usersRepository.findOne({
      where: { email: dto.email, isActive: true },
      relations: ['roles'],
      select: [
        'id',
        'email',
        'firstName',
        'lastName',
        'password',
        'isActive',
        'status',
        'isTwoFactorEnabled',
        'twoFactorSecret',
      ],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await user.validatePassword(dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify account status
    if (user.status === UserStatus.PENDING_VALIDATION) {
      throw new ForbiddenException(
        'Your account is pending administrator approval.',
      );
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Your account has been suspended.');
    }
    if (user.status === UserStatus.BANNED) {
      throw new ForbiddenException('Your account has been banned.');
    }

    if (user.isTwoFactorEnabled) {
      // Return a temporary token valid for 5 minutes
      const tempToken = await this.jwtService.signAsync(
        { sub: user.id, isTemp: true },
        { expiresIn: '5m' },
      );
      return { require2fa: true, tempToken };
    }

    const permissions: Permission[] = [
      ...new Set(user.roles.flatMap((role) => role.permissions)),
    ];

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      permissions,
      roles: user.roles.map((r) => r.name),
    };

    const tokens = await this.generateTokens(authUser, userAgent, ipAddress);
    return { require2fa: false, user: authUser, tokens };
  }

  async authenticate2fa(
    tempToken: string,
    code: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    let sub: string;
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        isTemp?: boolean;
      }>(tempToken);
      if (!payload.isTemp || !payload.sub) {
        throw new UnauthorizedException('Invalid temporary token');
      }
      sub = payload.sub;
    } catch {
      throw new UnauthorizedException('Temporary token expired or invalid');
    }

    const user = await this.usersRepository.findOne({
      where: { id: sub, isActive: true },
      relations: ['roles'],
      select: [
        'id',
        'email',
        'firstName',
        'lastName',
        'isActive',
        'status',
        'isTwoFactorEnabled',
        'twoFactorSecret',
      ],
    });

    if (!user || !user.isTwoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('2FA is not enabled for this user.');
    }

    const { valid: isValid } = await this.totp.verify(code, {
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    const permissions: Permission[] = [
      ...new Set(user.roles.flatMap((role) => role.permissions)),
    ];

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      permissions,
      roles: user.roles.map((r) => r.name),
    };

    const tokens = await this.generateTokens(authUser, userAgent, ipAddress);
    return { user: authUser, tokens };
  }

  async generate2faSecret(
    userId: string,
  ): Promise<{ qrCodeUrl: string; secret: string }> {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const secret = this.totp.generateSecret();
    const otpAuthUrl = this.totp.toURI({
      label: user.email,
      issuer: 'FutureFarm Logistic',
      secret,
    });
    const qrCodeUrl = await qrcode.toDataURL(otpAuthUrl);

    return { qrCodeUrl, secret };
  }

  async enable2fa(userId: string, code: string, secret: string): Promise<void> {
    const { valid: isValid } = await this.totp.verify(code, {
      secret,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid verification code.');
    }

    await this.usersRepository.update(
      { id: userId },
      {
        twoFactorSecret: secret,
        isTwoFactorEnabled: true,
      },
    );
  }

  async disable2fa(userId: string, code: string): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'twoFactorSecret'],
    });

    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA is not enabled.');
    }

    const { valid: isValid } = await this.totp.verify(code, {
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid verification code.');
    }

    await this.usersRepository.update(
      { id: userId },
      {
        twoFactorSecret: null,
        isTwoFactorEnabled: false,
      },
    );
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersRepository.findOneBy({ email });
    if (!user) {
      // Silently return to avoid user enumeration attacks
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour expiry

    await this.usersRepository.update(
      { id: user.id },
      {
        resetPasswordToken: token,
        resetPasswordExpires: expires,
      },
    );

    // Send recovery email via NotificationsModule
    const frontendUrl = this.config.get<string>(
      'CORS_ORIGINS',
      'http://localhost:3001',
    );
    const actionUrl = `${frontendUrl}/auth/reset-password?token=${token}`;

    try {
      await this.notificationsService.send({
        recipientIds: [user.id],
        title: 'Reset Your Password - FutureFarm',
        body: `To reset your password, please click the link below. If you did not request this, please ignore this email.`,
        channels: [NotificationChannel.EMAIL],
        priority: NotificationPriority.HIGH,
        metadata: {
          actionUrl,
          actionText: 'Reset Password',
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to send password recovery email to ${user.email}`,
        err,
      );
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { resetPasswordToken: token },
      select: ['id', 'resetPasswordExpires'],
    });

    if (
      !user ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires < new Date()
    ) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    // Assigning the new password. The BeforeUpdate/BeforeInsert hooks in UserEntity will hash it.
    const userInstance = await this.usersRepository.findOneBy({ id: user.id });
    if (!userInstance) {
      throw new NotFoundException('User not found.');
    }

    userInstance.password = newPassword;
    userInstance.resetPasswordToken = null;
    userInstance.resetPasswordExpires = null;

    await this.usersRepository.save(userInstance);
  }

  async getSessions(userId: string): Promise<UserSessionEntity[]> {
    return this.sessionRepository.find({
      where: { userId, isRevoked: false },
      order: { createdAt: 'DESC' },
    });
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findOneBy({
      id: sessionId,
      userId,
    });
    if (!session) {
      throw new NotFoundException('Session not found.');
    }
    session.isRevoked = true;
    await this.sessionRepository.save(session);
  }

  private async generateTokens(
    user: AuthUser,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      permissions: user.permissions,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.config.get<string>(
        'JWT_ACCESS_TOKEN_EXPIRY',
        '15m',
      ) as never,
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id },
      {
        expiresIn: this.config.get<string>(
          'JWT_REFRESH_TOKEN_EXPIRY',
          '7d',
        ) as never,
      },
    );

    // Hash the refresh token to store in the sessions table
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Create a new session record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Default to 7 days matching JWT expiry

    const session = new UserSessionEntity();
    session.userId = user.id;
    session.refreshTokenHash = hash;
    session.userAgent = userAgent ?? null;
    session.ipAddress = ipAddress ?? null;
    session.expiresAt = expiresAt;

    await this.sessionRepository.save(session);

    return { accessToken, refreshToken };
  }
}
