# Docker Usage

## Local Development

```bash
# Start all services (API, Web, DB)
docker-compose up

# Start only the database
docker-compose up db -d

# Follow logs of a specific service
docker-compose logs -f api

# Stop everything
docker-compose down

# Stop and remove volumes (⚠️ deletes database data)
docker-compose down -v
```

### What runs in dev mode:
- `db` — PostgreSQL 16 on port `5432`
- `api` — NestJS with hot-reload via `nest start --watch`, port `3000`
- `web` — Vite dev server, port `3001`

Source code is bind-mounted so changes are reflected instantly.

## Production

```bash
# Build and start all production services
docker-compose -f docker-compose.prod.yml up -d --build

# Check service health
docker-compose -f docker-compose.prod.yml ps

# View API logs
docker-compose -f docker-compose.prod.yml logs -f api
```

### What runs in prod mode:
- `db` — PostgreSQL 16, **not exposed externally** (internal network only)
- `api` — Built NestJS image, port `3000`
- `web` — Built static files served by nginx, port `80`

> [!IMPORTANT]
> All env vars in `docker-compose.prod.yml` have no defaults — set them in a `.env` file or pass them directly to the shell before running.
