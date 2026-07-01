import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

import { Permission, AuthUser, NotificationStatus } from '@futurefarm/types';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

import { NotificationsService } from './notifications.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { RegisterPushSubscriptionDto } from './dto/register-push-subscription.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @RequirePermissions(Permission.NOTIFICATION_SEND)
  @ApiOperation({ summary: 'Send targeted notification to specific users' })
  async send(@Body() dto: SendNotificationDto) {
    await this.notificationsService.send(dto);
    return { success: true };
  }

  @Post('broadcast')
  @RequirePermissions(Permission.NOTIFICATION_BROADCAST)
  @ApiOperation({ summary: 'Broadcast notification to all or filtered users' })
  async broadcast(@Body() dto: BroadcastNotificationDto) {
    await this.notificationsService.broadcast(dto);
    return { success: true };
  }

  @Get('me')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  @ApiOperation({
    summary: 'Get current user in-app notifications (paginated)',
  })
  async getMyNotifications(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.notificationsService.getMyNotifications(user.id, query);
  }

  @Get('me/unread-count')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  @ApiOperation({ summary: 'Get current user unread notification count' })
  async getUnreadCount(@CurrentUser() user: AuthUser) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  @Patch('me/:id/read')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user.id, id);
  }

  @Patch('me/read-all')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  @ApiOperation({ summary: 'Mark all unread notifications as read' })
  async markAllRead(@CurrentUser() user: AuthUser) {
    await this.notificationsService.markAllRead(user.id);
    return { success: true };
  }

  @Delete('me/:id')
  @RequirePermissions(Permission.NOTIFICATION_DELETE_OWN)
  @ApiOperation({ summary: 'Delete own in-app notification' })
  async deleteOwn(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.notificationsService.deleteOwn(user.id, id);
    return { success: true };
  }

  @Get('me/preferences')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  @ApiOperation({ summary: 'Get current user notification preferences' })
  async getPreferences(@CurrentUser() user: AuthUser) {
    return this.notificationsService.getPreferences(user.id);
  }

  @Put('me/preferences')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  @ApiOperation({ summary: 'Update current user notification preferences' })
  async updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(user.id, dto);
  }

  @Post('push-subscriptions')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  @ApiOperation({ summary: 'Register a web push subscription' })
  async registerPushSubscription(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterPushSubscriptionDto,
  ) {
    return this.notificationsService.registerPushSubscription(user.id, dto);
  }

  @Delete('push-subscriptions')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  @ApiOperation({ summary: 'Unregister a web push subscription' })
  async deletePushSubscription(
    @CurrentUser() user: AuthUser,
    @Query('endpoint') endpoint: string,
  ) {
    await this.notificationsService.deletePushSubscription(user.id, endpoint);
    return { success: true };
  }

  @Get('admin')
  @RequirePermissions(Permission.NOTIFICATION_ADMIN)
  @ApiOperation({ summary: 'Admin: Get all notifications' })
  async getAllNotificationsAdmin(
    @Query() query: PaginationQueryDto,
    @Query('userId') userId?: string,
    @Query('status') status?: NotificationStatus,
  ) {
    return this.notificationsService.getAllNotificationsAdmin(
      query,
      userId,
      status,
    );
  }

  @Delete('admin/:id')
  @RequirePermissions(Permission.NOTIFICATION_ADMIN)
  @ApiOperation({ summary: 'Admin: Delete any notification' })
  async deleteNotificationAdmin(@Param('id') id: string) {
    await this.notificationsService.deleteNotificationAdmin(id);
    return { success: true };
  }
}
