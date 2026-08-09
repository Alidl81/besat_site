# Backend container

The backend is part of the repository-level Compose application. The root
`docker-compose.yml` is the single source of truth for PostgreSQL, Django, and
the Next.js frontend; there is intentionally no separate backend-only Compose
file.

From the repository root:

```bash
cp .env.example .env
# Replace every change-me value in .env.
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
curl http://localhost:8000/api/health/
```

Create an administrator only when needed:

```bash
docker compose exec backend python manage.py createsuperuser
```

Stop containers while preserving the named PostgreSQL and media volumes:

```bash
docker compose down
```

For HTTPS deployments, terminate TLS at a reverse proxy and then enable the
secure redirect and HSTS variables documented in the root `.env.example`.
