#!/bin/sh
set -e

# Default DATABASE_URL to production SQLite file if not provided
export DATABASE_URL="${DATABASE_URL:-file:/app/prisma/prod.db}"

# If using a SQLite file, ensure its directory exists
case "$DATABASE_URL" in
  file:*)
    DB_PATH="${DATABASE_URL#file:}"
    # Strip any query parameters
    DB_PATH="${DB_PATH%%\?*}"
    DB_DIR="$(dirname "$DB_PATH")"
    if [ -n "$DB_DIR" ] && [ ! -d "$DB_DIR" ]; then
      echo "Creating SQLite database directory: $DB_DIR"
      mkdir -p "$DB_DIR" 2>/dev/null || true
    fi
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
    ./node_modules/.bin/prisma migrate deploy || echo "Warning: Database migration failed. Continuing startup..."
  elif command -v prisma >/dev/null 2>&1; then
    prisma migrate deploy || echo "Warning: Database migration failed. Continuing startup..."
  else
    echo "Notice: Prisma CLI not found; skipping automatic migrations."
  fi
fi

exec "$@"
