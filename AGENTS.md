# AGENTS.md — ParrHub

## Estructura del proyecto

```
parrahub/
├── backend/          # NestJS (Puerto 3000 → expuesto como 3001)
├── frontend/         # React + Vite (Puerto 5173 → expuesto como 5174)
├── docker/           # nginx, postgres init
├── k6/               # Pruebas de carga
└── .github/workflows/
```

## Desarrollo local

```bash
# Iniciar todo con hot-reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Puertos locales
# Frontend:      http://localhost:5174
# Backend API:   http://localhost:3001/api
# Nginx:         http://localhost:8085
# PostgreSQL:    localhost:5433
# MongoDB:       localhost:27018
# Redis:         localhost:6380
# MinIO API:     http://localhost:9002
# MinIO Console: http://localhost:9003
# Adminer:       http://localhost:8082
# Mongo Express: http://localhost:8083
```

## Comandos backend (dentro del contenedor o con pnpm)

```bash
# Tests con cobertura (70% mínimo requerido)
docker compose exec backend pnpm run test:cov

# Tests E2E
docker compose exec backend pnpm run test:e2e

# Migraciones Prisma
docker compose exec backend pnpm run db:migrate
docker compose exec backend pnpm run db:seed

# Lint
docker compose exec backend pnpm run lint
```

## Arquitectura de bases de datos

| Servicio   | Propósito                            |
| ---------- | ------------------------------------ |
| PostgreSQL | Admins, salas, metadatos de archivos |
| MongoDB    | Mensajes de chat (alto volumen)      |
| Redis      | Sesiones, BullMQ jobs, cache         |
| MinIO      | Archivos (S3-compatible)             |

## Stack tecnológico

- **Backend**: NestJS + Prisma + Socket.IO + BullMQ + MongoDB
- **Frontend**: React 19 + Vite + Zustand + TanStack Query + shadcn/ui
- **Deployment**: Docker + Nginx + GitHub Actions (deploy automático a VPS Hostinger)

## Convenciones

- Usar pnpm (no npm/yarn)
- Variables de entorno del frontend deben tener prefijo `VITE_` (Vite requirement)
- Backend necesita `db:generate` después de cambios en `schema.prisma`
- El JWT secret y credenciales admin están en `.env` (no versionar)

## Testing

- Jest para backend (unit + e2e)
- Vitest para frontend
- k6 para pruebas de carga (50 usuarios, latencia < 1s)
- Objetivo de cobertura: 70%

## Deployment

- Push a `main` → GitHub Actions → deploy automático a VPS
- El workflow está en `.github/workflows/hostinger.yml`
- Build + restart contenedores en el VPS

## Referencias

- Documentación completa: `README.md`
- Config de variables: `.env.example`
- Schema de datos: `backend/prisma/schema.prisma`
