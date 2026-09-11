#!/usr/bin/env sh
set -eu

if [ "${CONFIRM_RESTORE:-}" != "YES" ]; then
    echo "Refusing media restore: set CONFIRM_RESTORE=YES explicitly." >&2
    exit 2
fi

if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
    echo "Usage: CONFIRM_RESTORE=YES $0 path/to/media.tar.gz" >&2
    exit 2
fi

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-deploy/production.compose.env}"
APP_SERVICE="${APP_SERVICE:-backend}"
backup_file="$1"

if [ -f "$backup_file.sha256" ]; then
    sha256sum --check "$backup_file.sha256"
fi

docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" stop frontend backend
docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" start backend
docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" exec -T "$APP_SERVICE" \
    tar -C /app/media -xzf - < "$backup_file"
docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" up -d --no-deps frontend

printf 'Media restore completed from %s. Verify representative media URLs before routing traffic.\n' "$backup_file"
