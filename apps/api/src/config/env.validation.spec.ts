import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const validBaseConfig = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/futurefarm',
    JWT_SECRET: 'super-secret-key-that-is-at-least-32-characters-long',
  };

  it('validates with minimal valid config and applies defaults', () => {
    const validated = validateEnv(validBaseConfig);
    expect(validated['NODE_ENV']).toBe('development');
    expect(validated['API_PORT']).toBe(3000);
    expect(validated['SMTP_PORT']).toBe(587);
    expect(validated['SMTP_SECURE']).toBe(false);
    expect(validated['WHATSAPP_ENABLED']).toBe(false);
    expect(validated['PUSH_ENABLED']).toBe(false);
    expect(validated['PAYMENT_PROVIDER']).toBe('mock');
  });

  it('accepts empty strings for unconfigured providers without crashing', () => {
    const configWithEmptyProviders = {
      ...validBaseConfig,
      SMTP_HOST: '',
      SMTP_PORT: '',
      SMTP_SECURE: '',
      SMTP_USER: '',
      SMTP_PASS: '',
      SMTP_FROM: '',
      TWILIO_ACCOUNT_SID: '',
      TWILIO_AUTH_TOKEN: '',
      TWILIO_PHONE_NUMBER: '',
      TWILIO_WHATSAPP_FROM: '',
      VAPID_PUBLIC_KEY: '',
      VAPID_PRIVATE_KEY: '',
      VAPID_SUBJECT: '',
      STRIPE_SECRET_KEY: '',
    };

    expect(() => validateEnv(configWithEmptyProviders)).not.toThrow();
    const validated = validateEnv(configWithEmptyProviders);
    expect(validated['SMTP_HOST']).toBe('');
    expect(validated['SMTP_PORT']).toBe(587);
    expect(validated['SMTP_SECURE']).toBe(false);
  });

  it('throws error when required fields are missing', () => {
    expect(() => validateEnv({})).toThrow(/Environment validation failed/);
  });
});
