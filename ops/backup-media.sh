#!/usr/bin/env sh
set -eu

# Back up Django MEDIA_ROOT from the persistent backend volume. This is
# separate from pg_dump because uploaded files are not stored in PostgreSQL.

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-deploy/production.compose.env}"
BACKUP_DIR="${BACKUP_DIR:-deploy/backups}"
APP_SERVICE="${APP_SERVICE:-backend}"

umask 077
mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/besat-media-$timestamp.tar.gz"
completed=0

cleanup() {
    if [ "$completed" -ne 1 ]; then
        rm -f -- "$backup_file"
    fi
}
trap cleanup EXIT HUP INT TERM

docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" exec -T "$APP_SERVICE" \
    tar -C /app/media -czf - . > "$backup_file"

test -s "$backup_file"
sha256sum "$backup_file" > "$backup_file.sha256"
completed=1

printf 'Media backup created: %s\n' "$backup_file"
printf 'SHA-256 recorded: %s\n' "$backup_file.sha256"
