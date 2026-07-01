import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

import { NotificationChannel } from '@futurefarm/types';
import {
  INotificationChannel,
  NotificationPayload,
} from './notification-channel.interface';

@Injectable()
export class EmailChannel implements INotificationChannel {
  private readonly logger = new Logger(EmailChannel.name);
  readonly channel = NotificationChannel.EMAIL;
  private transporter: nodemailer.Transporter | null = null;
  private template: handlebars.TemplateDelegate | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initTransporter();
    this.initTemplate();
  }

  private initTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const secure = this.configService.get<boolean>('SMTP_SECURE', false);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP credentials not fully configured. Email channel running in [DRY RUN] mode.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  private initTemplate() {
    try {
      const templatePath = path.join(
        __dirname,
        '..',
        'templates',
        'email',
        'notification.hbs',
      );
      if (fs.existsSync(templatePath)) {
        const source = fs.readFileSync(templatePath, 'utf8');
        this.template = handlebars.compile(source);
        return;
      }
    } catch (err) {
      this.logger.error(
        'Failed to load email template file, using fallback template.',
        err,
      );
    }

    const fallbackSource = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f9fafb;
      margin: 0;
      padding: 0;
      color: #111827;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      border: 1px solid #e5e7eb;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #4f46e5, #4338ca);
      padding: 32px 24px;
      color: #ffffff;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    .content {
      padding: 32px 24px;
      line-height: 1.6;
    }
    .content h2 {
      margin-top: 0;
      font-size: 20px;
      font-weight: 600;
      color: #111827;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 9999px;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    .badge-high { background-color: #fee2e2; color: #991b1b; }
    .badge-normal { background-color: #e0e7ff; color: #3730a3; }
    .badge-low { background-color: #f3f4f6; color: #374151; }
    .cta-container {
      margin-top: 32px;
      text-align: center;
    }
    .cta-button {
      display: inline-block;
      background-color: #4f46e5;
      color: #ffffff !important;
      padding: 12px 24px;
      font-weight: 600;
      text-decoration: none;
      border-radius: 6px;
      transition: background-color 0.2s;
    }
    .footer {
      background-color: #f9fafb;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>FutureFarm</h1>
    </div>
    <div class="content">
      <div class="badge badge-{{priority}}">{{priority}} Priority</div>
      <h2>{{title}}</h2>
      <p>{{body}}</p>
      {{#if actionUrl}}
      <div class="cta-container">
        <a href="{{actionUrl}}" class="cta-button" target="_blank">{{actionText}}</a>
      </div>
      {{/if}}
    </div>
    <div class="footer">
      <p>This is an automated notification from Future Farm Logistic.</p>
      <p>&copy; 2026 FutureFarm. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;
    this.template = handlebars.compile(fallbackSource);
  }

  async send(payload: NotificationPayload): Promise<void> {
    const from = this.configService.get<string>(
      'SMTP_FROM',
      'FutureFarm <noreply@futurefarm.io>',
    );
    const actionUrl = payload.metadata?.actionUrl as string | undefined;
    const actionText =
      (payload.metadata?.actionText as string | undefined) || 'View Details';

    const html = this.template
      ? this.template({
          title: payload.title,
          body: payload.body,
          priority: payload.priority.toLowerCase(),
          actionUrl,
          actionText,
        })
      : `<p>${payload.body}</p>`;

    if (!this.transporter) {
      this.logger.log(
        `[DRY RUN] Email to ${payload.userEmail}: [${payload.priority}] ${payload.title} - ${payload.body}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from,
        to: payload.userEmail,
        subject: payload.title,
        text: `${payload.title}\n\n${payload.body}`,
        html,
      });
      this.logger.log(`Email successfully sent to ${payload.userEmail}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${payload.userEmail}`, err);
      throw err;
    }
  }
}
