import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Headers,
  Ip,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';

import { Permission, AuthUser } from '@futurefarm/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Verify2faDto, Authenticate2faDto } from './dto/2fa.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/password-recovery.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiOkResponse({ description: 'Returns tokens or require2fa status' })
  async login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ipAddress?: string,
  ) {
    return this.authService.login(dto, userAgent, ipAddress);
  }

  @Post('2fa/authenticate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 2FA TOTP code for login' })
  @ApiOkResponse({ description: 'Returns access and refresh tokens' })
  async authenticate2fa(
    @Body() dto: Authenticate2faDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ipAddress?: string,
  ) {
    return this.authService.authenticate2fa(
      dto.tempToken,
      dto.code,
      userAgent,
      ipAddress,
    );
  }

  @Post('2fa/generate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate 2FA TOTP secret and QR code' })
  async generate2faSecret(@CurrentUser() user: AuthUser) {
    return this.authService.generate2faSecret(user.id);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable 2FA by verifying the first code' })
  async enable2fa(
    @CurrentUser() user: AuthUser,
    @Body() dto: Verify2faDto & { secret: string },
  ) {
    await this.authService.enable2fa(user.id, dto.code, dto.secret);
    return { success: true };
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable 2FA' })
  async disable2fa(@CurrentUser() user: AuthUser, @Body() dto: Verify2faDto) {
    await this.authService.disable2fa(user.id, dto.code);
    return { success: true };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { success: true };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { success: true };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.SESSION_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active login sessions' })
  async getSessions(@CurrentUser() user: AuthUser) {
    return this.authService.getSessions(user.id);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.SESSION_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke an active login session' })
  async revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.authService.revokeSession(user.id, id);
    return { success: true };
  }
}
