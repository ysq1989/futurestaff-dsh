# Server container deployment

## Prerequisites

- Linux server with Docker Engine and Docker Compose v2.
- Git access to this repository.
- DeepSeek API key.
- For production, the real Selection Center base URL and API key.

## Development or test server

The development stack runs two containers. The Mock is available only on the private Compose network; only DSH is published, and only on server loopback.

```bash
cp .env.example .env
# Set DEEPSEEK_API_KEY in .env.
docker compose --env-file .env -f docker/compose.dev.yml up -d --build
docker compose -f docker/compose.dev.yml ps
docker compose -f docker/compose.dev.yml logs -f futurestaff-dsh
```

Reach the server safely before an authenticated gateway exists:

```bash
ssh -L 3080:127.0.0.1:3080 user@your-server
```

Then open `http://127.0.0.1:3080` on your own computer.

## Production server

```bash
cp .env.production.example .env.production
# Fill every blank required value and restrict the file to the deployment user.
chmod 600 .env.production
docker compose --env-file .env.production -f docker/compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker/compose.prod.yml ps
```

Production Compose fails before creating the container when a required value is absent. It never defines or starts the Selection Center Mock.

## Reverse proxy

Keep `127.0.0.1:3080:3080`; do not publish `3080` on `0.0.0.0`. Put the supplied Nginx example behind HTTPS and an authenticated access layer. Until FutureStaff authentication is implemented, prefer an SSH tunnel or a strict VPN/IP allowlist rather than a public hostname.

## Upgrade and rollback

```bash
git pull --ff-only
docker compose --env-file .env.production -f docker/compose.prod.yml build --pull
docker compose --env-file .env.production -f docker/compose.prod.yml up -d
```

Tag deployed images with an immutable version in `FUTURESTAFF_DSH_IMAGE`. Roll back by restoring the previous tag and running `up -d` again. The named `$DSH_HOME` volume is retained across replacements; back it up before any migration that changes persisted formats.

## Operational checks

- `docker compose ps` reports DSH healthy.
- DSH logs contain Selection Center completion events with operation, outcome, duration, and request ID.
- No log record contains API keys, tenant IDs, user IDs, or request bodies.
- A failed Selection Center call reports a stable error code instead of raw upstream content.
