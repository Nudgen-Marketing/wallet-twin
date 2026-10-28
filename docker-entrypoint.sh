#!/bin/sh
set -e

# Production SQLite lives on the /app/data volume so it survives redeploys.
export DATABASE_URL="${DATABASE_URL:-file:/app/data/prod.db}"
# Where the database goes when the configured directory can't be written: lost on redeploy.
EPHEMERAL_DATABASE_URL="file:/app/prisma/prod.db"

# If using a SQLite file, make sure its directory exists and this (non-root) user can write it.
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
    if [ -n "$DB_DIR" ] && touch "$DB_DIR/.write-test" 2>/dev/null; then
      rm -f "$DB_DIR/.write-test"
      if [ -f "$DB_PATH" ]; then
        echo "Using existing SQLite database: $DB_PATH"
      else
        echo "Creating SQLite database: $DB_PATH"
      fi
    else
      # A host-path mount is owned by root, but the app runs as uid 1001. Keep the demo up on an
      # ephemeral database rather than crash, and say loudly how to fix it.
      echo "WARNING: $DB_DIR is not writable by uid $(id -u); falling back to $EPHEMERAL_DATABASE_URL."
      echo "WARNING: Data will be LOST on the next deploy. Use a named persistent directory for /app/data, or chown it to 1001."
      export DATABASE_URL="$EPHEMERAL_DATABASE_URL"
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
