import * as Joi from 'joi';

export function validateEnv(config: Record<string, unknown>) {
  const schema = Joi.object({
    NODE_ENV: Joi.string()
      .valid('development', 'production', 'test')
      .default('development'),
    API_PORT: Joi.number().default(3000),
    DATABASE_URL: Joi.string().uri().required(),
    JWT_SECRET: Joi.string().min(32).required(),
    JWT_ACCESS_TOKEN_EXPIRY: Joi.string().default('15m'),
    JWT_REFRESH_TOKEN_EXPIRY: Joi.string().default('7d'),
    CORS_ORIGINS: Joi.string().default('http://localhost:3001'),
    REDIS_URL: Joi.string().uri().default('redis://localhost:6379'),
    SMTP_HOST: Joi.string().optional(),
    SMTP_PORT: Joi.number().default(587),
    SMTP_SECURE: Joi.boolean().default(false),
    SMTP_USER: Joi.string().optional(),
    SMTP_PASS: Joi.string().optional(),
    SMTP_FROM: Joi.string().optional(),
    TWILIO_ACCOUNT_SID: Joi.string().optional(),
    TWILIO_AUTH_TOKEN: Joi.string().optional(),
    TWILIO_PHONE_NUMBER: Joi.string().optional(),
    TWILIO_WHATSAPP_FROM: Joi.string().optional(),
    VAPID_PUBLIC_KEY: Joi.string().optional(),
    VAPID_PRIVATE_KEY: Joi.string().optional(),
    VAPID_SUBJECT: Joi.string().optional(),
    WHATSAPP_ENABLED: Joi.boolean().default(false),
    PUSH_ENABLED: Joi.boolean().default(false),
    HARVEST_APPROVAL_MIN_SCORE: Joi.number().default(4.0),
  }).unknown(true);

  const result = schema.validate(config, { abortEarly: false });

  if (result.error) {
    throw new Error(
      `Environment validation failed:\n${result.error.details.map((d) => `  - ${d.message}`).join('\n')}`,
    );
  }

  return result.value as Record<string, unknown>;
}
