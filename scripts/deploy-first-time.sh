#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/OWNER/REPO.git}"
APP_DIR="${APP_DIR:-/opt/chat-realtime}"

apt-get update
apt-get install -y ca-certificates curl git certbot
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

mkdir -p "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Edita $APP_DIR/.env con secretos reales antes de continuar."
  exit 1
fi

docker compose up -d
(crontab -l 2>/dev/null; echo "0 0 * * 0 certbot renew --quiet && docker compose -f $APP_DIR/docker-compose.yml restart nginx") | crontab -
