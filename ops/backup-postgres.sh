#!/usr/bin/env sh
set -eu

# Create a private, timestamped PostgreSQL custom-format dump from the
# production Compose database. The password stays inside the database
# container's environment and is never placed in the command line or output.

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-deploy/production.compose.env}"
BACKUP_DIR="${BACKUP_DIR:-deploy/backups}"
DB_SERVICE="${DB_SERVICE:-db}"

umask 077
mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/besat-postgres-$timestamp.dump"
completed=0

cleanup() {
    if [ "$completed" -ne 1 ]; then
        rm -f -- "$backup_file"
    fi
}
trap cleanup EXIT HUP INT TERM

docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" sh -ceu '
    test -n "${POSTGRES_DB:-}" \
        && test -n "${POSTGRES_USER:-}" \
        && test -n "${POSTGRES_PASSWORD:-}"
    export PGHOST=127.0.0.1
    export PGPASSWORD="$POSTGRES_PASSWORD"
    pg_dump --format=custom --no-owner --no-acl \
        --file=- --username="$POSTGRES_USER" "$POSTGRES_DB"
' > "$backup_file"

test -s "$backup_file"
sha256sum "$backup_file" > "$backup_file.sha256"
completed=1

printf 'PostgreSQL backup created: %s\n' "$backup_file"
printf 'SHA-256 recorded: %s\n' "$backup_file.sha256"
