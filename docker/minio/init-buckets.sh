#!/usr/bin/env sh
set -eu

mc alias set local "http://${MINIO_ENDPOINT}:${MINIO_PORT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}"
mc mb --ignore-existing "local/${MINIO_BUCKET}"
mc anonymous set download "local/${MINIO_BUCKET}"
