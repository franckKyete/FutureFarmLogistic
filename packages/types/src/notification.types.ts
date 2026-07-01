// =============================================================================
// @futurefarm/types — Notifications Types & Enums
// =============================================================================

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  DATABASE = 'database',
  PUSH = 'push',
  WHATSAPP = 'whatsapp',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  READ = 'read',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
}

/** Shape of a stored in-app (database channel) notification */
export interface NotificationDto {
  id: string;
  title: string;
  body: string;
  status: NotificationStatus;
  priority: NotificationPriority;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  readAt: string | null;
}

/** Per-channel opt-in flags stored per user */
export interface NotificationPreferencesDto {
  email: boolean;
  sms: boolean;
  database: boolean;
  push: boolean;
  whatsapp: boolean;
}
