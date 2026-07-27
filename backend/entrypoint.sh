#!/bin/sh
set -eu

if [ "${WAIT_FOR_DATABASE:-1}" = "1" ]; then
  attempt=1
  max_attempts="${DATABASE_WAIT_MAX_ATTEMPTS:-30}"
  delay_seconds="${DATABASE_WAIT_DELAY_SECONDS:-2}"

  until python -c "from django.db import connections; connections['default'].ensure_connection()" >/dev/null 2>&1; do
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "Database did not become available after ${max_attempts} attempts." >&2
      exit 1
    fi

    echo "Waiting for database (${attempt}/${max_attempts})..." >&2
    attempt=$((attempt + 1))
    sleep "$delay_seconds"
  done
fi

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  python manage.py migrate --noinput
fi

if [ "${SEED_PUBLIC_DATA:-0}" = "1" ]; then
  python manage.py seed_public_data
fi

if [ "${COLLECT_STATIC:-0}" = "1" ]; then
  python manage.py collectstatic --noinput
fi

exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${WEB_CONCURRENCY:-3}" \
  --threads "${GUNICORN_THREADS:-2}" \
  --timeout "${GUNICORN_TIMEOUT:-60}"
