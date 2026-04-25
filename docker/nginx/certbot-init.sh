#!/usr/bin/env sh
set -eu

: "${DOMAIN:?Define DOMAIN en el .env raíz}"
: "${CERTBOT_EMAIL:?Define CERTBOT_EMAIL en el .env raíz}"

certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# Hostinger:
# 1. Apunta el registro A del dominio a la IP pública del VPS.
# 2. Levanta nginx en HTTP para exponer /.well-known/acme-challenge/.
# 3. Ejecuta este script dentro de un contenedor con certbot y los mismos volúmenes.
