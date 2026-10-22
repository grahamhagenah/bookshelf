#!/bin/sh -ex

# This file is how Fly starts the server (configured in fly.toml). Before starting
# the server though, we need to run any prisma migrations that haven't yet been
# run, which is why this file exists in the first place.
# Learn more: https://community.fly.io/t/sqlite-not-getting-setup-properly/4386

# allocate swap space
fallocate -l 512M /swapfile
chmod 0600 /swapfile
mkswap /swapfile
echo 10 > /proc/sys/vm/swappiness
swapon /swapfile
echo 1 > /proc/sys/vm/overcommit_memory

prisma() {
  node node_modules/prisma/build/index.js "$@"
}

DB_FILE="${DATABASE_URL#file:}"
DB_FILE="${DB_FILE%%\?*}"

# Backups: with LITESTREAM_BUCKET set (see "Backups" in the README), every
# change is streamed to R2 while the app runs. If the volume ever comes up
# without a database, the latest backup is put back before anything else.
# Without it, the app starts exactly as before.
if [ -n "$LITESTREAM_BUCKET" ]; then
  litestream restore -config /etc/litestream.yml -if-db-not-exists -if-replica-exists "$DB_FILE"
fi

# Until October 2026 the schema was kept in step with `prisma db push`,
# which skips the migration history. A database from then already has
# every change up to the catch-up migration, so the first time it starts
# with this script those migrations are recorded as applied rather than
# run. A new, empty database runs them all as normal.
CAUGHT_UP=20261022000000_catch_up_with_db_push
if [ -f "$DB_FILE" ] \
  && [ -n "$(sqlite3 "$DB_FILE" "select name from sqlite_master where type='table' and name='User'")" ] \
  && [ -z "$(sqlite3 "$DB_FILE" "select 1 from _prisma_migrations where migration_name='$CAUGHT_UP' and finished_at is not null" 2>/dev/null)" ]; then
  for dir in prisma/migrations/*/; do
    name=$(basename "$dir")
    if [ -z "$(sqlite3 "$DB_FILE" "select 1 from _prisma_migrations where migration_name='$name' and finished_at is not null" 2>/dev/null)" ]; then
      prisma migrate resolve --applied "$name"
    fi
    [ "$name" = "$CAUGHT_UP" ] && break
  done
fi

# Apply any migrations that haven't run yet. Schema changes now come with a
# migration: `npx prisma migrate dev --name what-changed`
prisma migrate deploy

if [ -n "$LITESTREAM_BUCKET" ]; then
  exec litestream replicate -config /etc/litestream.yml -exec "npm run start"
fi
npm run start
