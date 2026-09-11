#!/usr/bin/env sh
set -eu

# Destructive restore is deliberately opt-in. Stop application writers first,
# restore the custom-format dump into the existing database, then recreate the
# application services and run health checks.

if [ "${CONFIRM_RESTORE:-}" != "YES" ]; then
    echo "Refusing restore: set CONFIRM_RESTORE=YES explicitly." >&2
    exit 2
fi

if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
    echo "Usage: CONFIRM_RESTORE=YES $0 path/to/backup.dump" >&2
    exit 2
fi

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-deploy/production.compose.env}"
DB_SERVICE="${DB_SERVICE:-db}"
backup_file="$1"

if [ -f "$backup_file.sha256" ]; then
    sha256sum --check "$backup_file.sha256"
fi

docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" stop frontend backend collectstatic migrate

docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" sh -ceu '
    test -n "${POSTGRES_DB:-}" \
        && test -n "${POSTGRES_USER:-}" \
        && test -n "${POSTGRES_PASSWORD:-}"
    export PGHOST=127.0.0.1
    export PGPASSWORD="$POSTGRES_PASSWORD"
    pg_restore --exit-on-error --clean --if-exists --no-owner --no-acl \
        --dbname="$POSTGRES_DB" --username="$POSTGRES_USER"
' < "$backup_file"

docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" up -d --no-deps backend frontend
docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" ps

printf 'Restore completed from %s. Verify /api/health/ and the public smoke paths before routing traffic.\n' "$backup_file"
