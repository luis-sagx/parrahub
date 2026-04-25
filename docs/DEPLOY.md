# Deploy en VPS

## Requisitos

- VPS con Ubuntu, 2GB RAM mínimo y 20GB de disco.
- Dominio apuntando con registro A a la IP pública del VPS.
- Secrets en GitHub: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`.

## Primer despliegue

1. Conecta por SSH al VPS.
2. Ejecuta `REPO_URL=https://github.com/OWNER/REPO.git sudo -E bash scripts/deploy-first-time.sh`.
3. Edita `/opt/chat-realtime/.env` con valores reales.
4. Ejecuta `docker compose up -d --build`.
5. Ejecuta las migraciones: `docker compose exec backend pnpm exec prisma migrate deploy`.

## SSL

El proxy usa certificados en `/etc/letsencrypt/live/$DOMAIN`. Para emitirlos, apunta el dominio al VPS y ejecuta Certbot usando el webroot `/var/www/certbot`. El script `docker/nginx/certbot-init.sh` deja documentado el comando.

## Operación

- Logs backend: `docker compose logs -f backend`
- Estado: `docker compose ps`
- Reinicio: `docker compose restart backend nginx`
- Rollback: `git checkout <commit> && docker compose up -d --build`

## Backups

`scripts/backup.sh` guarda PostgreSQL, MongoDB y el volumen de MinIO en `/opt/backups` y elimina respaldos con más de 7 días.

Cron recomendado:

```bash
0 2 * * * /opt/chat-realtime/scripts/backup.sh
```
