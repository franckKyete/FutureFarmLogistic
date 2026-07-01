import { NotificationChannel, NotificationPriority } from '@futurefarm/types';

export interface NotificationPayload {
  userId: string;
  userEmail: string;
  userPhone: string | null;
  title: string;
  body: string;
  priority: NotificationPriority;
  metadata: Record<string, unknown>;
  notificationId: string;
}

export interface INotificationChannel {
  readonly channel: NotificationChannel;
  send(payload: NotificationPayload): Promise<void>;
}
