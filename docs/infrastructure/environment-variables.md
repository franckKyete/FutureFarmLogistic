# Environment Variables Reference

All environment variables are defined in `.env.example` at the monorepo root.

## Required Variables

| Variable | Used by | Description |
|---|---|---|
| `DATABASE_URL` | api | PostgreSQL connection string |
| `JWT_SECRET` | api | Secret for signing JWT tokens (min 32 chars) |

## API Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `production`, or `test` |
| `API_PORT` | `3000` | Port the NestJS API listens on |
| `PORT` | Render-provided | Runtime port provided by Render; takes precedence over `API_PORT` |
| `DB_SYNCHRONIZE` | `false` | Temporarily set to `true` for the first production schema initialization; disable afterward |
| `POSTGRES_HOST` | `localhost` | DB host (overridden by `DATABASE_URL`) |
| `POSTGRES_PORT` | `5432` | DB port |
| `POSTGRES_DB` | `futurefarm` | Database name |
| `POSTGRES_USER` | `futurefarm` | DB user |
| `POSTGRES_PASSWORD` | `changeme` | DB password |
| `JWT_ACCESS_TOKEN_EXPIRY` | `15m` | Access token lifespan |
| `JWT_REFRESH_TOKEN_EXPIRY` | `7d` | Refresh token lifespan |
| `CORS_ORIGINS` | `http://localhost:3001` | Comma-separated allowed origins |

## Web Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:3000/v1` | API base URL (public, bundled into build) |

## Notification & Queue Variables

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL for Bull queues |

## Object Storage Variables

| Variable | Description |
|---|---|
| `S3_BUCKET` | Bucket name |
| `S3_REGION` | Storage region (`auto` for Cloudflare R2) |
| `S3_ENDPOINT` | S3-compatible endpoint, such as the Cloudflare R2 endpoint |
| `S3_PUBLIC_ENDPOINT` | Optional public/custom endpoint used in generated signed URLs |
| `S3_ACCESS_KEY_ID` | S3/R2 access key |
| `S3_SECRET_ACCESS_KEY` | S3/R2 secret key |
| `S3_SIGNED_URL_EXPIRES_IN` | Signed URL lifetime in seconds |
| `SMTP_HOST` | | SMTP server hostname for Email |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_SECURE` | `false` | Enable TLS for SMTP |
| `SMTP_USER` | | SMTP auth username |
| `SMTP_PASS` | | SMTP auth password |
| `SMTP_FROM` | `FutureFarm <noreply@futurefarm.io>` | Sender email header |
| `TWILIO_ACCOUNT_SID` | | Twilio Account SID for SMS & WhatsApp |
| `TWILIO_AUTH_TOKEN` | | Twilio Auth Token |
| `TWILIO_PHONE_NUMBER` | | Sender SMS phone number |
| `TWILIO_WHATSAPP_FROM`| | Sender Twilio WhatsApp identifier |
| `VAPID_PUBLIC_KEY` | | VAPID public key for Web Push |
| `VAPID_PRIVATE_KEY`| | VAPID private key for Web Push |
| `VAPID_SUBJECT` | `mailto:admin@futurefarm.io` | VAPID subject metadata |
| `WHATSAPP_ENABLED` | `false` | Enable Twilio WhatsApp channel |
| `PUSH_ENABLED` | `false` | Enable Web Push channel |

## Payment Gateway Variables

| Variable | Default | Description |
|---|---|---|
| `PAYMENT_PROVIDER` | `mock` | Default fallback provider (`stripe`, `pawapay`, `mock`) |
| `STRIPE_SECRET_KEY` | | Stripe secret key for card checkout |
| `STRIPE_CURRENCY` | `usd` | Stripe processing currency |
| `PAWAPAY_API_TOKEN` | | PawaPay Merchant API bearer token |
| `PAWAPAY_BASE_URL` | `https://api.sandbox.pawapay.io` | PawaPay API endpoint (sandbox or production) |
| `PAWAPAY_COUNTRY` | `SEN` | PawaPay default ISO3 country code |
| `PAWAPAY_CURRENCY` | `XOF` | PawaPay default currency code |
| `PAWAPAY_RETURN_URL` | `http://localhost:3001/orders` | Buyer redirect destination after Mobile Money payment |
| `PAWAPAY_PRIVATE_KEY` | | Optional EC private key (PEM format) for RFC-9421 request signing |
| `PAWAPAY_KEY_ID` | `1` | Key identifier registered in PawaPay Dashboard for RFC-9421 signing |

> [!CAUTION]
> Never prefix secret values with `VITE_` — Vite bundles all `VITE_*` variables into the client JS and they will be publicly visible.

## Generating a JWT Secret

```bash
openssl rand -hex 64
```
