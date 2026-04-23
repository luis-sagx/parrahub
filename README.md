# Stack Tecnológico — Sistema de Chat en Tiempo Real

## Frontend

| Librería | Uso |
|---|---|
| `react` + `vite` | UI dinámica con build rápido |
| `socket.io-client` | Conexión WebSocket con el backend |
| `zustand` | Estado global liviano (sala actual, usuario, sesión) |
| `@tanstack/react-query` | Cache de lista de salas y usuarios |
| `react-hook-form` + `zod` | Validación de PIN y nickname en cliente |
| `shadcn/ui` + `tailwindcss` | Componentes accesibles y diseño responsivo |
| `axios` | Subida de archivos con progress bar |

```bash
npm i react react-dom socket.io-client zustand \
  @tanstack/react-query react-hook-form zod axios \
  tailwindcss shadcn-ui
```

---

## Backend

| Librería | Uso |
|---|---|
| `@nestjs/core` + `@nestjs/platform-express` | Framework principal |
| `@nestjs/websockets` + `socket.io` | WebSockets con rooms nativas |
| `bullmq` | Cola de jobs para procesar archivos (corre sobre Redis) |
| `jsonwebtoken` + `@nestjs/jwt` | Tokens del admin |
| `bcrypt` | Hasheo de contraseñas y PINs |
| `class-validator` + `class-transformer` | Validación de DTOs, previene inyecciones |
| `multer` + `@nestjs/platform-express` | Recepción de archivos en el servidor |
| `prisma` | ORM para PostgreSQL con tipos TypeScript automáticos |
| `mongoose` | ODM para MongoDB (mensajes) |
| `ioredis` | Cliente Redis para sesiones y BullMQ |
| `aws-sdk` (o `minio` client) | Interfaz con MinIO |

```bash
npm i @nestjs/core @nestjs/platform-express @nestjs/websockets \
  socket.io bullmq jsonwebtoken @nestjs/jwt bcrypt \
  class-validator class-transformer multer \
  prisma @prisma/client mongoose ioredis aws-sdk
```

---

## Bases de datos y almacenamiento

| Tecnología | Uso |
|---|---|
| `PostgreSQL 16` | Admins, salas, metadatos de archivos |
| `MongoDB 7` | Mensajes de chat (documentos sin JOIN) |
| `Redis 7` | Sesiones por IP, usuarios conectados, BullMQ jobs |
| `MinIO` | Almacenamiento de archivos físicos (self-hosted en VPS) |

### Por qué cada base de datos

- **PostgreSQL** para datos relacionales estrictos: `Admin → Salas → Archivos`
- **MongoDB** para mensajes: alto volumen, sin JOIN, esquema flexible
- **Redis** para todo lo que necesita velocidad en memoria y TTL automático
- **MinIO** compatible con la API de AWS S3, sin depender de servicios externos

---

## Deploy en VPS Hostinger

| Herramienta | Uso |
|---|---|
| `Docker` + `docker-compose` | Todos los servicios en contenedores |
| `Nginx` | Reverse proxy, sirve frontend estático, redirige `/api` y WebSocket |
| `certbot` | SSL gratuito con Let's Encrypt |
| `GitHub Actions` | CI/CD: push a main → build → deploy automático |
| `PM2` (opcional) | Reinicio automático del proceso Node dentro del contenedor |

### Servicios en docker-compose

```
nginx          → reverse proxy + SSL
nestjs-app     → backend (puerto 3000)
react-app      → build estático servido por nginx
postgresql     → base de datos relacional
mongodb        → base de datos de mensajes
redis          → cache + sesiones + BullMQ
minio          → almacenamiento de archivos
```

---

## Testing

| Herramienta | Uso |
|---|---|
| `jest` + `@nestjs/testing` | Tests unitarios e integración |
| `supertest` | Tests de endpoints HTTP |
| `socket.io-mock` | Mocks de WebSocket para tests |
| `istanbul` (incluido en Jest) | Reporte de cobertura — objetivo: 70% (requisito de rúbrica) |
| `k6` | Prueba de carga con 50+ usuarios simulados (requisito de rúbrica) |

```bash
npm i -D jest @nestjs/testing supertest socket.io-mock @types/jest
# k6 se instala por separado: https://k6.io/docs/get-started/installation/
```

---

## Resumen del flujo de datos

```
Usuario envía mensaje
       ↓
  Socket.IO recibe
       ↓
  Redis verifica sesión (~1ms)
       ↓
  MongoDB guarda mensaje (~5ms, async)  ←─ en paralelo
       ↓
  Socket.IO broadcast a sala
       ↓
  Mensaje visible en < 100ms
```

```
Usuario sube archivo
       ↓
  Multer recibe el archivo
       ↓
  BullMQ encola el job (no bloquea)
       ↓
  Worker Thread procesa y sube a MinIO
       ↓
  URL guardada en PostgreSQL
       ↓
  Socket.IO notifica a la sala
```
