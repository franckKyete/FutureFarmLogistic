# Backend — Notifications Module

The Notifications Module provides a robust, multi-channel system to send targeted alerts to specific users or broadcast notifications to all or filtered users. It supports five channels: **Email, SMS, Database (in-app), Web Push, and WhatsApp**.

## Architecture

The module uses the **Strategy + Queue** pattern:

1. **Orchestration**: The `NotificationsService` validates requests and stores database records in `pending` status.
2. **Queuing**: Messages are enqueued into a Bull queue (`notifications`) powered by Redis. This keeps HTTP requests fast and handles failures asynchronously.
3. **Execution**: The `NotificationsProcessor` consumes jobs off the queue.
4. **Filtering**: The processor loads the recipient's `NotificationPreferencesEntity` and filters out disabled channels.
5. **Delivery**: For each remaining channel, the corresponding channel class (implementing `INotificationChannel`) is executed.

```
POST /v1/notifications
        │
        ▼
NotificationsController
        │
        ▼
NotificationsService  ──── checks preferences, validates targets
        │
        ▼  (enqueues job)
Bull Queue: "notifications" (Redis)
        │
        ▼
NotificationsProcessor
        │
        ├─► EmailChannel      (Nodemailer + Handlebars)
        ├─► SmsChannel        (Twilio SMS)
        ├─► DatabaseChannel   (TypeORM → notifications table)
        ├─► PushChannel       (web-push → push_subscriptions table)
        └─► WhatsAppChannel   (Twilio WhatsApp)
```

---

## Channels

### 1. Database (In-App)
- Always active.
- Creates/updates `NotificationEntity` records.
- Consumed by the web client via `GET /v1/notifications/me`.

### 2. Email
- Uses `nodemailer` + `handlebars` for rich HTML rendering.
- Templates are located at `src/modules/notifications/templates/email/`.
- In local development, falls back to `[DRY RUN]` logs if SMTP variables are not set.

### 3. SMS
- Powered by Twilio.
- Requires recipient's `phoneNumber` to be present.

### 4. Push
- Powered by the `web-push` library using VAPID keys.
- Requires browser device tokens registered via `POST /v1/notifications/push-subscriptions`.
- Cleans up stale tokens on `404` or `410` errors from push service providers.

### 5. WhatsApp
- Powered by Twilio WhatsApp sandbox.
- Disabled by default. Can be enabled via `WHATSAPP_ENABLED=true`.

---

## Notification Preferences

Users can customize which channels they receive notifications on via `PUT /v1/notifications/me/preferences`.
The user preferences are stored in the `NotificationPreferencesEntity` database table, gating execution at the queue processor stage.

---

## REST API Reference

All routes are prefix with `/v1/notifications` and require a valid Bearer JWT.

### Send Notification
`POST /v1/notifications` (Permission: `notification:send`)
```json
{
  "recipientIds": ["uuid-user-1"],
  "title": "Delivery Arrived",
  "body": "Your farm package has arrived.",
  "channels": ["database", "email"],
  "priority": "normal",
  "metadata": {
    "actionUrl": "/farms/123",
    "actionText": "View Farm"
  }
}
```

### Broadcast Notification
`POST /v1/notifications/broadcast` (Permission: `notification:broadcast`)
```json
{
  "title": "System Maintenance",
  "body": "System will be down for 10 minutes tonight.",
  "channels": ["database", "push"],
  "priority": "high",
  "filterByRole": "Driver"
}
```

### Get My Notifications (Paginated)
`GET /v1/notifications/me?page=1&limit=20` (Permission: `notification:read`)

### Get Unread Count
`GET /v1/notifications/me/unread-count` (Permission: `notification:read`)

### Mark as Read
`PATCH /v1/notifications/me/:id/read` (Permission: `notification:read`)

### Mark All as Read
`PATCH /v1/notifications/me/read-all` (Permission: `notification:read`)

### Delete Own Notification
`DELETE /v1/notifications/me/:id` (Permission: `notification:delete:own`)

### Get Preferences
`GET /v1/notifications/me/preferences` (Permission: `notification:read`)

### Update Preferences
`PUT /v1/notifications/me/preferences` (Permission: `notification:read`)
```json
{
  "email": true,
  "sms": false,
  "push": true
}
```

### Register Push Subscription
`POST /v1/notifications/push-subscriptions` (Permission: `notification:read`)
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "p256dh": "...",
  "auth": "...",
  "userAgent": "Mozilla/5.0 ..."
}
```

### Unregister Push Subscription
`DELETE /v1/notifications/push-subscriptions?endpoint=...` (Permission: `notification:read`)
