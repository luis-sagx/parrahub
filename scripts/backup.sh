#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/backups}"
APP_DIR="${APP_DIR:-/opt/chat-realtime}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR/$STAMP"
cd "$APP_DIR"

docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-chatuser}" "${POSTGRES_DB:-chatdb}" | gzip > "$BACKUP_DIR/$STAMP/postgres.sql.gz"
docker compose exec -T mongodb mongodump --archive --gzip --username "${MONGO_INITDB_ROOT_USERNAME:-chatuser}" --password "${MONGO_INITDB_ROOT_PASSWORD:-chatpassword}" --authenticationDatabase admin > "$BACKUP_DIR/$STAMP/mongo.archive.gz"
docker run --rm -v chat-realtime_minio-data:/data -v "$BACKUP_DIR/$STAMP:/backup" alpine tar czf /backup/minio-data.tar.gz /data

find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} +
