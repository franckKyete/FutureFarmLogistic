import * as Joi from 'joi';

export function validateEnv(config: Record<string, unknown>) {
  const schema = Joi.object({
    NODE_ENV: Joi.string()
      .valid('development', 'production', 'test')
      .empty('')
      .default('development'),
    API_PORT: Joi.number().empty('').default(3000),
    DATABASE_URL: Joi.string().uri().required(),
    JWT_SECRET: Joi.string().min(32).required(),
    JWT_ACCESS_TOKEN_EXPIRY: Joi.string().empty('').default('15m'),
    JWT_REFRESH_TOKEN_EXPIRY: Joi.string().empty('').default('7d'),
    CORS_ORIGINS: Joi.string().empty('').default('http://localhost:3001'),
    REDIS_URL: Joi.string().allow('').empty('').default('redis://localhost:6379'),
    SMTP_HOST: Joi.string().allow('').optional(),
    SMTP_PORT: Joi.number().empty('').default(587),
    SMTP_SECURE: Joi.boolean().empty('').default(false),
    SMTP_USER: Joi.string().allow('').optional(),
    SMTP_PASS: Joi.string().allow('').optional(),
    SMTP_FROM: Joi.string().allow('').optional(),
    TWILIO_ACCOUNT_SID: Joi.string().allow('').optional(),
    TWILIO_AUTH_TOKEN: Joi.string().allow('').optional(),
    TWILIO_PHONE_NUMBER: Joi.string().allow('').optional(),
    TWILIO_WHATSAPP_FROM: Joi.string().allow('').optional(),
    VAPID_PUBLIC_KEY: Joi.string().allow('').optional(),
    VAPID_PRIVATE_KEY: Joi.string().allow('').optional(),
    VAPID_SUBJECT: Joi.string().allow('').optional(),
    WHATSAPP_ENABLED: Joi.boolean().empty('').default(false),
    PUSH_ENABLED: Joi.boolean().empty('').default(false),
    HARVEST_APPROVAL_MIN_SCORE: Joi.number().empty('').default(4.0),
    PAYMENT_PROVIDER: Joi.string().valid('stripe', 'mock').empty('').default('mock'),
    STRIPE_SECRET_KEY: Joi.string().allow('').optional(),
    STRIPE_CURRENCY: Joi.string().empty('').default('usd'),
    STRIPE_SUCCESS_URL: Joi.string().allow('').optional(),
    STRIPE_CANCEL_URL: Joi.string().allow('').optional(),
  }).unknown(true);

  const result = schema.validate(config, { abortEarly: false });

  if (result.error) {
    throw new Error(
      `Environment validation failed:\n${result.error.details.map((d) => `  - ${d.message}`).join('\n')}`,
    );
  }

  return result.value as Record<string, unknown>;
}
