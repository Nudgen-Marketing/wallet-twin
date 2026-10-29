#!/bin/sh
set -e

# All app data lives in Postgres, so it survives redeploys. Fail fast rather than run without it.
case "$DATABASE_URL" in
  postgres://*|postgresql://*) ;;
  "")
    echo "ERROR: DATABASE_URL is not set. Set it to your Postgres connection string (postgresql://user:password@host:5432/db)."
    exit 1
    ;;
  *)
    echo "ERROR: DATABASE_URL must be a postgresql:// connection string."
    exit 1
    ;;
esac

# Auto-generate temporary SESSION_SECRET if missing to prevent startup crash
if [ -z "$SESSION_SECRET" ]; then
  echo "WARNING: SESSION_SECRET is not set in environment."
  echo "Generating an ephemeral 48-char SESSION_SECRET for this container run."
  echo "For production persistence across restarts, set SESSION_SECRET (min 32 characters) in your environment."
  export SESSION_SECRET="$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 48)"
fi

# Run database migrations unless skipped
if [ "${SKIP_DB_MIGRATE:-false}" != "true" ]; then
  echo "Applying database migrations..."
  if [ -x "./node_modules/.bin/prisma" ]; then
    PRISMA="./node_modules/.bin/prisma"
  elif command -v prisma >/dev/null 2>&1; then
    PRISMA="prisma"
  else
    PRISMA=""
    echo "Notice: Prisma CLI not found; skipping automatic migrations."
  fi
  # Postgres may still be starting (e.g. both apps restarted together): retry for about a minute.
  attempt=1
  while [ -n "$PRISMA" ] && ! $PRISMA migrate deploy; do
    if [ "$attempt" -ge 12 ]; then
      echo "Warning: Database migration failed after $attempt attempts. Continuing startup..."
      break
    fi
    echo "Database not ready (attempt $attempt); retrying in 5s..."
    attempt=$((attempt + 1))
    sleep 5
  done
fi

exec "$@"
