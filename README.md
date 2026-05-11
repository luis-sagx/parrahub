# Stack Tecnológico — Sistema de Chat en Tiempo Real

## Frontend

| Librería                    | Uso                                                  |
| --------------------------- | ---------------------------------------------------- |
| `react` + `vite`            | UI dinámica con build rápido                         |
| `socket.io-client`          | Conexión WebSocket con el backend                    |
| `zustand`                   | Estado global liviano (sala actual, usuario, sesión) |
| `@tanstack/react-query`     | Cache de lista de salas y usuarios                   |
| `react-hook-form` + `zod`   | Validación de PIN y nickname en cliente              |
| `shadcn/ui` + `tailwindcss` | Componentes accesibles y diseño responsivo           |
| `axios`                     | Subida de archivos con progress bar                  |

```bash
npm i react react-dom socket.io-client zustand \
  @tanstack/react-query react-hook-form zod axios \
  tailwindcss shadcn-ui
```

---

## Backend

| Librería                                    | Uso                                                       |
| ------------------------------------------- | --------------------------------------------------------- |
| `@nestjs/core` + `@nestjs/platform-express` | Framework principal                                       |
| `@nestjs/websockets` + `socket.io`          | WebSockets con rooms nativas                              |
| `bullmq`                                    | Cola de jobs para procesar archivos (corre sobre Redis)   |
| `jsonwebtoken` + `@nestjs/jwt`              | Tokens del admin                                          |
| `bcrypt`                                    | Hasheo de contraseñas y PINs                              |
| `class-validator` + `class-transformer`     | Validación de DTOs, previene inyecciones                  |
| `multer` + `@nestjs/platform-express`       | Recepción de archivos en el servidor                      |
| `prisma`                                    | ORM para PostgreSQL con tipos TypeScript automáticos      |
| `mongoose`                                  | ODM para MongoDB (mensajes)                               |
| `ioredis`                                   | Cliente Redis para sesiones por deviceId, gracia y BullMQ |
| `aws-sdk` (o `minio` client)                | Interfaz con MinIO                                        |

```bash
npm i @nestjs/core @nestjs/platform-express @nestjs/websockets \
  socket.io bullmq jsonwebtoken @nestjs/jwt bcrypt \
  class-validator class-transformer multer \
  prisma @prisma/client mongoose ioredis aws-sdk
```

---

## Bases de datos y almacenamiento

| Tecnología      | Uso                                                     |
| --------------- | ------------------------------------------------------- |
| `PostgreSQL 16` | Admins, salas, metadatos de archivos                    |
| `MongoDB 7`     | Mensajes de chat (documentos sin JOIN)                  |
| `Redis 7`       | Sesiones por IP, usuarios conectados, BullMQ jobs       |
| `MinIO`         | Almacenamiento de archivos físicos (self-hosted en VPS) |

### Por qué cada base de datos

- **PostgreSQL** para datos relacionales estrictos: `Admin → Salas → Archivos`
- **MongoDB** para mensajes: alto volumen, sin JOIN, esquema flexible
- **Redis** para todo lo que necesita velocidad en memoria y TTL automático
- **MinIO** compatible con la API de AWS S3, sin depender de servicios externos

---

## Deploy en VPS Hostinger

| Herramienta                 | Uso                                                                 |
| --------------------------- | ------------------------------------------------------------------- |
| `Docker` + `docker-compose` | Todos los servicios en contenedores                                 |
| `Nginx`                     | Reverse proxy, sirve frontend estático, redirige `/api` y WebSocket |
| `certbot`                   | SSL gratuito con Let's Encrypt                                      |
| `GitHub Actions`            | CI/CD: push a main → build → deploy automático                      |
| `PM2` (opcional)            | Reinicio automático del proceso Node dentro del contenedor          |

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

| Herramienta                   | Uso                                                               |
| ----------------------------- | ----------------------------------------------------------------- |
| `jest` + `@nestjs/testing`    | Tests unitarios e integración                                     |
| `supertest`                   | Tests de endpoints HTTP                                           |
| `socket.io-mock`              | Mocks de WebSocket para tests                                     |
| `istanbul` (incluido en Jest) | Reporte de cobertura — objetivo: 70% (requisito de rúbrica)       |
| `k6`                          | Prueba de carga con 50+ usuarios simulados (requisito de rúbrica) |

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

# Estructura del repositorio — Sistema de Chat en Tiempo Real

```
chat-realtime/
├── .github/
│   └── workflows/
│       ├── deploy.yml              # CI/CD: push a main → build → SSH → restart contenedores
│       └── test.yml                # Corre Jest + Supertest en cada PR, genera reporte de cobertura
│
├── backend/
│   ├── src/
│   │   ├── auth/
│   │   │   ├── auth.module.ts      # Importa JwtModule y PrismaModule
│   │   │   ├── auth.controller.ts  # POST /auth/login → retorna JWT al admin
│   │   │   ├── auth.service.ts     # Valida credenciales con bcrypt, genera JWT firmado
│   │   │   ├── auth.guard.ts       # Guard que verifica JWT en headers para rutas protegidas
│   │   │   └── dto/
│   │   │       └── login.dto.ts    # username (string), password (string, minLength 8)
│   │   │
│   │   ├── rooms/
│   │   │   ├── rooms.module.ts     # Importa PrismaModule y RedisModule
│   │   │   ├── rooms.controller.ts # GET /rooms, POST /rooms, DELETE /rooms/:id (solo admin)
│   │   │   ├── rooms.service.ts    # Crea sala con UUID, hashea PIN con bcrypt, guarda en PostgreSQL
│   │   │   └── dto/
│   │   │       └── create-room.dto.ts  # name, type (TEXT | MULTIMEDIA), pin (minLength 4)
│   │   │
│   │   ├── gateway/                # ★ Corazón del chat en tiempo real
│   │   │   ├── chat.gateway.ts     # Socket.IO gateway: join-room, send-message, disconnect
│   │   │   │                       #   - Verifica sesión Redis antes de cada operación
│   │   │   │                       #   - Broadcast con io.to(roomId).emit()
│   │   │   ├── chat.gateway.spec.ts# Tests con socket.io-mock: join, mensaje, desconexión
│   │   │   └── session.guard.ts    # Verifica IP sin sesión activa en otra sala (Redis)
│   │   │
│   │   ├── files/
│   │   │   ├── files.module.ts     # Registra Multer, BullMQ queue 'file-processing', MinioModule
│   │   │   ├── files.controller.ts # POST /files/upload → valida tipo/tamaño, encola en BullMQ
│   │   │   ├── files.service.ts    # Sube a MinIO, guarda URL en PostgreSQL, notifica sala vía WS
│   │   │   ├── file.processor.ts   # Worker BullMQ en Worker Thread separado (no bloquea servidor)
│   │   │   └── dto/
│   │   │       └── upload-file.dto.ts  # roomId, nickname, validación MIME y tamaño máximo
│   │   │
│   │   ├── redis/
│   │   │   ├── redis.module.ts     # Configura ioredis desde .env, exportable a todos los módulos
│   │   │   └── redis.service.ts    # setSession(deviceId, roomId, ttl), grace:{deviceId}, getRoomUsers(roomId)
│   │   │
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts    # Singleton global del PrismaClient
│   │   │   └── prisma.service.ts   # Conecta en onModuleInit, desconecta en onModuleDestroy
│   │   │
│   │   ├── minio/
│   │   │   ├── minio.module.ts     # Cliente MinIO con endpoint, accessKey y secretKey desde .env
│   │   │   └── minio.service.ts    # uploadFile(), getPresignedUrl(key, expiry), deleteFile(key)
│   │   │
│   │   ├── common/
│   │   │   ├── pipes/
│   │   │   │   └── validation.pipe.ts          # GlobalValidationPipe con class-validator, rechaza con 400
│   │   │   ├── filters/
│   │   │   │   └── http-exception.filter.ts    # Respuesta estructurada {statusCode, message, timestamp}
│   │   │   └── guards/
│   │   │       └── ws-session.guard.ts         # Guard WebSocket: sesión única por IP
│   │   │
│   │   ├── app.module.ts           # Módulo raíz: ConfigModule, todos los módulos, BullModule global
│   │   └── main.ts                 # Bootstrap: CORS, GlobalPipe, GlobalFilter, puerto 3000
│   │
│   ├── prisma/
│   │   ├── schema.prisma           # ★ Modelos: Admin, Room, FileMetadata con relaciones FK
│   │   ├── migrations/             # Autogenerado por Prisma (una subcarpeta por migración con SQL)
│   │   └── seed.ts                 # Crea admin por defecto con credenciales del .env
│   │
│   ├── test/
│   │   ├── app.e2e-spec.ts         # E2E: login admin → crear sala → unirse con PIN → enviar mensaje
│   │   └── jest-e2e.json           # Config Jest para E2E: transform, testRegex, moduleNameMapper
│   │
│   ├── .env.example                # DATABASE_URL, MONGODB_URI, REDIS_URL, JWT_SECRET,
│   │                               # MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, ADMIN_PASSWORD
│   ├── Dockerfile                  # Multi-stage: build (compila TS) → prod (solo dist/ + deps)
│   ├── package.json                # Scripts: start:dev, build, test, test:cov, test:e2e
│   ├── tsconfig.json               # Target ES2021, strict mode, paths @auth @rooms @common
│   └── nest-cli.json               # entryFile: main, compilerOptions: deleteOutDir
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AdminLogin.tsx      # Formulario login admin (react-hook-form + zod + JWT)
│   │   │   ├── AdminDashboard.tsx  # Lista salas (TanStack Query), crear sala, eliminar sala
│   │   │   ├── JoinRoom.tsx        # Formulario público: PIN + nickname → navega a ChatRoom
│   │   │   ├── ChatRoom.tsx        # ★ Vista principal: usuarios, mensajes en tiempo real, input
│   │   │   └── NotFound.tsx        # Página 404
│   │   │
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── MessageList.tsx # Mensajes con scroll automático, estilo propio vs ajeno
│   │   │   │   ├── MessageInput.tsx# Input texto, Enter para enviar, emite send-message
│   │   │   │   ├── FileUpload.tsx  # Drag & drop, progress bar con Axios, solo salas multimedia
│   │   │   │   └── UserList.tsx    # Lista lateral de nicknames, actualiza con users-updated
│   │   │   ├── rooms/
│   │   │   │   └── CreateRoomModal.tsx  # Modal admin: nombre, tipo, PIN con validación Zod
│   │   │   └── ui/                 # Autogenerado por shadcn/ui (Button, Input, Dialog, Badge...)
│   │   │
│   │   ├── store/
│   │   │   ├── authStore.ts        # JWT del admin en Zustand, persistido en sessionStorage
│   │   │   └── chatStore.ts        # roomId, nickname, messages[], connectedUsers[] en Zustand
│   │   │
│   │   ├── hooks/
│   │   │   ├── useSocket.ts        # ★ Inicializa socket.io-client, eventos new-message y users-updated
│   │   │   ├── useRooms.ts         # TanStack Query para GET /rooms, invalida cache al mutar
│   │   │   └── useFileUpload.ts    # Upload con Axios, estado progreso 0-100%, manejo de errores
│   │   │
│   │   ├── services/
│   │   │   ├── api.ts              # Instancia Axios con baseURL y interceptor JWT automático
│   │   │   ├── roomsApi.ts         # getRooms(), createRoom(dto), deleteRoom(id) tipadas
│   │   │   └── filesApi.ts         # uploadFile(file, roomId) con multipart/form-data y progreso
│   │   │
│   │   ├── lib/
│   │   │   ├── socket.ts           # Singleton Socket.IO: withCredentials, autoConnect:false, auth.deviceId persistente
│   │   │   ├── queryClient.ts      # QueryClient global con staleTime y retry configurados
│   │   │   └── validations.ts      # Schemas Zod: pinSchema (min 4 dígitos), nicknameSchema (max 20)
│   │   │
│   │   ├── types/
│   │   │   └── index.ts            # Interfaces: Room, Message, UploadedFile, User, RoomType, SocketEvents
│   │   │
│   │   ├── App.tsx                 # Router v6: /login, /dashboard, /join, /room/:id
│   │   └── main.tsx                # Entry point: QueryClientProvider + React.StrictMode
│   │
│   ├── public/                     # Assets estáticos: favicon, og-image
│   ├── .env.example                # VITE_API_URL, VITE_SOCKET_URL
│   ├── Dockerfile                  # Build Vite → Nginx sirve el dist/ generado
│   ├── nginx.conf                  # SPA fallback: rutas desconocidas → index.html
│   ├── vite.config.ts              # Proxy dev /api → backend:3000, alias @, plugin React
│   ├── tailwind.config.ts          # Tema custom, paths de shadcn/ui en content
│   └── package.json                # Scripts: dev, build, preview. Deps: react, vite, socket.io-client...
│
├── docker/
│   ├── nginx/
│   │   └── nginx.conf              # ★ Reverse proxy: HTTPS 443, /api → nestjs:3000,
│   │                               #   /socket.io con upgrade WS, / → frontend estático
│   └── postgres/
│       └── init.sql                # Crea el database inicial (Prisma maneja el schema)
│
├── k6/
│   ├── load-test.js                # ★ 50 usuarios virtuales: conectar, PIN, enviar mensajes
│   │                               #   Verifica latencia < 1 segundo (requisito de rúbrica)
│   └── smoke-test.js               # 1 usuario, sanidad de todos los endpoints
│
├── docker-compose.yml              # ★ 7 servicios: nginx, backend, frontend, postgres,
│                                   #   mongodb, redis, minio — red interna 'chat-net'
├── docker-compose.dev.yml          # Override dev: volúmenes hot-reload, puertos expuestos
├── .env.example                    # Plantilla global con TODAS las variables de entorno
├── .gitignore                      # node_modules, dist, .env, *.log, coverage/
└── README.md                       # ★ Descripción, arquitectura, instalación, endpoints,
                                    #   variables de entorno y diagrama (1 punto de rúbrica)
```

---

## Archivos más importantes (★)

| Archivo                               | Por qué es crítico                                          |
| ------------------------------------- | ----------------------------------------------------------- |
| `backend/src/gateway/chat.gateway.ts` | Núcleo del chat: eventos WS, verificación sesión, broadcast |
| `backend/prisma/schema.prisma`        | Define toda la estructura de datos en PostgreSQL            |
| `frontend/src/hooks/useSocket.ts`     | Conecta el estado React con los eventos del servidor        |
| `frontend/src/pages/ChatRoom.tsx`     | Vista principal que el usuario ve y usa                     |
| `docker-compose.yml`                  | Levanta los 7 servicios de un solo comando                  |
| `docker/nginx/nginx.conf`             | Enruta HTTPS, WebSocket y archivos estáticos                |
| `k6/load-test.js`                     | Prueba de 50 usuarios (requisito de rúbrica)                |
| `README.md`                           | Documentación (1 punto directo de rúbrica)                  |

---

## Variables de entorno requeridas

```bash
# PostgreSQL
DATABASE_URL="postgresql://chatuser:chatpassword@localhost:5433/chatdb"

# MongoDB
MONGODB_URI="mongodb://chatuser:chatpassword@localhost:27018/chatdb?authSource=admin"

# Redis
REDIS_URL="redis://localhost:6380"

# JWT
JWT_SECRET="tu-secreto-super-seguro-aqui"
JWT_EXPIRES_IN="8h"

# Admin por defecto (usado en seed.ts)
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="tu-password-seguro"

# MinIO
MINIO_ENDPOINT="localhost"
MINIO_PORT=9002
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET="chat-files"

# Frontend (prefijo VITE_ obligatorio para Vite)
VITE_API_URL="http://localhost:3001/api"
VITE_SOCKET_URL="http://localhost:3001"
```

---

## Comandos para arrancar

```bash
# Clonar y configurar
git clone https://github.com/tu-usuario/chat-realtime.git
cd chat-realtime
cp .env.example .env
# Editar .env con tus credenciales

# Desarrollo local (hot-reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Accesos locales
# Frontend Vite:   http://localhost:5174
# Backend API:     http://localhost:3001/api
# Nginx:           http://localhost:8085
# PostgreSQL:      localhost:5433
# MongoDB:         localhost:27018
# Redis:           localhost:6380
# MinIO API:       http://localhost:9002
# MinIO Console:   http://localhost:9003
# Adminer:         http://localhost:8082
# Mongo Express:   http://localhost:8083

# Producción en VPS
docker compose up -d --build

# Migraciones de base de datos (primera vez)
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed

# Tests
docker compose exec backend npm run test:cov   # Jest + cobertura
docker compose exec backend npm run test:e2e   # Tests end-to-end

# Prueba de carga (k6 debe estar instalado)
k6 run k6/load-test.js
```

---

## Control de sesión por dispositivo

El sistema garantiza que cada dispositivo físico solo pueda tener **una sesión activa por sala** al mismo tiempo, bloqueando múltiples pestañas, ventanas y —en la mayoría de los casos— diferentes navegadores en el mismo equipo.

### Cómo funciona

El sistema usa **dos claves de sesión en Redis simultáneamente**:

| Clave | Basada en | Fiabilidad |
|---|---|---|
| `device:<UUID>` | UUID en `localStorage` | Confiable — misma pestaña/ventana en el mismo browser |
| `ip:<IP>:fp:<fingerprint>` | IP de red + fingerprint de hardware | Best-effort — bloquea mismo equipo en diferente browser cuando las señales no están falsificadas |

El frontend genera el UUID al primer acceso y calcula el fingerprint con señales de hardware consistentes entre browsers (familia de SO, timezone del sistema, dimensiones físicas de pantalla).

```
Cliente abre browser → UUID en localStorage (si no existe)
                     → fingerprint: hash(OS|timezone|screen)
                     → envía ambos en handshake auth.{deviceId, deviceFingerprint}

Backend guarda en Redis:
  device:<UUID>              →  { roomId, nickname }  (TTL 2h)
  ip:<IP>:fp:<fingerprint>   →  { roomId, nickname }  (TTL 2h)
```

### Verificación al unirse a una sala

```
Nuevo intento de conexión
        ↓
¿Existe device:<UUID>?          → SÍ → ALREADY_IN_ROOM  (misma pestaña/ventana)
        ↓ NO
¿Existe ip:<IP>:fp:<fp>?        → SÍ → ALREADY_IN_ROOM  (mismo equipo, otro browser)
        ↓ NO
Validar PIN → validar nickname → unirse → guardar ambas claves
```

### Escenarios cubiertos

| Escenario | Resultado | Mecanismo |
|---|---|---|
| Mismo browser, otra pestaña | ❌ Bloqueado | `device:<UUID>` (mismo localStorage) |
| Mismo browser, otra ventana | ❌ Bloqueado | `device:<UUID>` (mismo localStorage) |
| Mismo equipo, Chrome → Firefox | ❌ Bloqueado* | `ip:<IP>:fp:<fingerprint>` |
| Mismo equipo, Chrome → Opera | ❌ Bloqueado* | `ip:<IP>:fp:<fingerprint>` |
| Computador + celular en la misma red | ✅ Permitido | IPs distintas (LAN) o fingerprints distintos |
| Distintos usuarios, misma red WiFi | ✅ Permitido | Fingerprints distintos (hardware distinto) |

> \* **Limitación conocida:** Firefox con `privacy.resistFingerprinting` activo falsifica timezone y dimensiones de pantalla, generando un fingerprint diferente al de Chrome aunque sea el mismo equipo. En ese caso específico la segunda verificación no detecta la sesión duplicada. La primera verificación (`device:<UUID>`) sigue siendo siempre confiable.

> **Por qué no se usa solo la IP:** Si la única clave fuera la IP, todos los usuarios de la misma red (WiFi universitaria, datos móviles con CGNAT) compartirían IP pública y solo uno podría entrar. El UUID garantiza unicidad por browser-perfil y el fingerprint agrega la dimensión de hardware sin romper múltiples dispositivos en red.

### Reconexión rápida (grace period)

Si un usuario cierra el browser accidentalmente y vuelve a abrir en los próximos **5 segundos** (configurable en `DISCONNECT_GRACE_MS`), el sistema lo reconecta a la misma sala sin perder el historial ni notificar al resto de usuarios que salió:

```
Cierre accidental
      ↓
Backend guarda grace:{deviceId} en Redis (TTL 5s)
      ↓
Usuario reconecta dentro del grace period
      ↓
Reconexión silenciosa → join-success con reconnected: true
      ↓ (si no reconecta en 5s)
Se limpian ambas claves de sesión → "usuario salió" se emite a la sala
```

### Archivos relevantes

| Archivo | Qué hace |
|---|---|
| `backend/src/gateway/chat.gateway.ts` | Genera las dos claves, verifica ambas sesiones, maneja grace period |
| `backend/src/redis/redis.service.ts` | `setSession`, `getSession`, `setGrace`, `getGrace` |
| `frontend/src/lib/socket.ts` | Genera el UUID persistente en `localStorage` y lo envía en el handshake |
| `frontend/src/lib/deviceFingerprint.ts` | Calcula el fingerprint de hardware (OS + timezone + pantalla) |

---

## Flujo de datos por capas

```
Cliente (React)
    │  HTTPS / WSS
    ▼
Nginx (reverse proxy + SSL)
    │  /api → :3000  |  /socket.io → WS upgrade  |  / → static
    ▼
NestJS (backend)
    ├── Auth module     → PostgreSQL (credenciales admin)
    ├── Rooms module    → PostgreSQL (salas, PINs hasheados)
    ├── Chat gateway    → Redis (sesiones) + MongoDB (mensajes)
    └── Files module    → BullMQ (cola) → MinIO (archivos)
                                       → PostgreSQL (metadatos URL)
```
