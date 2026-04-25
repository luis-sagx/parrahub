# Plan de Desarrollo — Sistema de Chat en Tiempo Real
## Grupo de 3 personas · Con agentes de IA

> **Estrategia general:** cada persona es dueña completa de su dominio.
> No comparten archivos en edición simultánea. La integración ocurre en puntos definidos.
> Cada tarea está redactada para dársela directamente a un agente de IA (Claude, Cursor, Copilot).

---

## Resumen de responsabilidades

| Persona | Dominio | Tecnologías principales |
|---|---|---|
| **P1 — Backend Core** | Auth, Rooms, Gateway WebSocket, Redis, Prisma, DB | NestJS, Socket.IO, Redis, PostgreSQL, JWT, bcrypt |
| **P2 — Backend Files + Infra** | Archivos, MinIO, BullMQ, Workers, Docker, deploy VPS | NestJS, BullMQ, MinIO, Docker, Nginx, GitHub Actions |
| **P3 — Frontend completo** | Toda la UI, estado, hooks, servicios, diseño responsivo | React, Vite, Zustand, TanStack Query, shadcn/ui, Axios |

---

## Orden de ejecución global

```
SEMANA 1
  P1: Base del proyecto + Auth + Rooms + Prisma schema
  P2: docker-compose completo + todos los servicios levantados
  P3: Setup frontend + páginas admin + componentes base

SEMANA 2
  P1: Chat Gateway WebSocket + Redis + sesión única por IP
  P2: Files module + BullMQ + MinIO + Worker Thread
  P3: ChatRoom UI + hooks useSocket + useFileUpload

SEMANA 3 (integración + tests)
  P1: Tests unitarios backend (Jest), documentación API
  P2: Tests E2E + prueba de carga k6 + deploy VPS final
  P3: Tests frontend + pulido UI + README final
```

---

---

# PERSONA 1 — Backend Core

> **Dominio:** toda la lógica del servidor excepto archivos.
> Archivos propios: `backend/src/auth/`, `backend/src/rooms/`, `backend/src/gateway/`,
> `backend/src/redis/`, `backend/src/prisma/`, `backend/src/common/`, `backend/prisma/`

---

## P1 · Tarea 1 — Inicializar el proyecto NestJS y configurar Prisma

**Duración estimada:** 1 día

**Prompt para agente de IA:**
```
Crea un proyecto NestJS desde cero con las siguientes características:
- Usa @nestjs/cli para generar el proyecto base
- Instala y configura: prisma, @prisma/client, @nestjs/config, class-validator,
  class-transformer, @nestjs/jwt, bcrypt, @types/bcrypt
- Configura ConfigModule como global en app.module.ts leyendo variables de .env
- Crea el schema.prisma con estos modelos exactos:
    model Admin {
      id        String   @id @default(uuid())
      username  String   @unique
      password  String
      createdAt DateTime @default(now())
      rooms     Room[]
    }
    model Room {
      id          String    @id @default(uuid())
      name        String
      pin         String
      type        RoomType  @default(TEXT)
      maxFileSize Int       @default(10)
      createdAt   DateTime  @default(now())
      adminId     String
      admin       Admin     @relation(fields: [adminId], references: [id])
      files       FileMetadata[]
    }
    model FileMetadata {
      id        String   @id @default(uuid())
      filename  String
      url       String
      size      Int
      mimeType  String
      roomId    String
      room      Room     @relation(fields: [roomId], references: [id])
      createdAt DateTime @default(now())
    }
    enum RoomType { TEXT MULTIMEDIA }
- Crea PrismaModule y PrismaService (singleton global)
- Crea seed.ts que lea ADMIN_USERNAME y ADMIN_PASSWORD del .env y cree el admin
  hasheando la contraseña con bcrypt
- Configura tsconfig.json con paths: @auth, @rooms, @gateway, @common, @prisma
- Genera .env.example con: DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, ADMIN_USERNAME, ADMIN_PASSWORD
- Crea el Dockerfile multi-stage para el backend
```

**Entregable:** repositorio con backend arrancando en `npm run start:dev` y migraciones corriendo.

---

## P1 · Tarea 2 — Módulo de autenticación del administrador

**Duración estimada:** 1 día

**Prompt para agente de IA:**
```
En el proyecto NestJS existente, crea el módulo de autenticación completo:

AuthModule que importe: JwtModule (con SECRET y expiresIn del .env), PrismaModule
AuthController con:
  - POST /auth/login: recibe {username, password}, devuelve {access_token, expiresIn}
  - POST /auth/logout: invalida token (opcional: blacklist en Redis)
AuthService con:
  - login(dto): busca admin por username, compara password con bcrypt.compare,
    si válido firma JWT con payload {sub: admin.id, username}
  - validateToken(token): verifica y decodifica JWT
LoginDto con class-validator:
  - username: string, IsNotEmpty, MaxLength(50)
  - password: string, IsNotEmpty, MinLength(8)
JwtAuthGuard que extienda AuthGuard('jwt') de @nestjs/passport
  - Al fallar devuelva 401 con mensaje claro
Aplica JwtAuthGuard a todos los endpoints del AdminController (se creará después)
Escribe tests unitarios en auth.service.spec.ts:
  - Test: login con credenciales correctas devuelve JWT
  - Test: login con password incorrecta lanza UnauthorizedException
  - Test: login con usuario inexistente lanza UnauthorizedException
Usa mocks de PrismaService con jest.fn()
```

**Entregable:** endpoints `/auth/login` y `/auth/logout` funcionales con tests pasando.

---

## P1 · Tarea 3 — Módulo de salas de chat

**Duración estimada:** 1 día

**Prompt para agente de IA:**
```
En el proyecto NestJS existente, crea el módulo de gestión de salas completo:

RoomsModule que importe: PrismaModule, JwtAuthGuard
RoomsController protegido con JwtAuthGuard:
  - POST /rooms: crea sala
  - GET /rooms: lista todas las salas del admin autenticado (sin exponer el PIN)
  - GET /rooms/:id: detalle de sala (sin PIN)
  - DELETE /rooms/:id: elimina sala (verifica que pertenece al admin)
RoomsService:
  - create(adminId, dto): genera UUID, hashea PIN con bcrypt, guarda en PostgreSQL
  - findAll(adminId): retorna salas del admin sin el campo pin
  - findOne(id): retorna sala sin pin
  - validatePin(roomId, pin): busca sala, compara pin con bcrypt.compare, retorna boolean
  - delete(id, adminId): verifica ownership antes de eliminar
CreateRoomDto:
  - name: string, IsNotEmpty, MinLength(3), MaxLength(50)
  - type: IsEnum(RoomType)
  - pin: string, IsNotEmpty, MinLength(4), MaxLength(10), Matches(/^\d+$/)
  - maxFileSize: number, IsOptional, Min(1), Max(100), default 10
Escribe tests unitarios en rooms.service.spec.ts:
  - Test: crear sala hashea el PIN (no guarda PIN plano)
  - Test: validatePin retorna true con PIN correcto
  - Test: validatePin retorna false con PIN incorrecto
  - Test: findAll no retorna el campo pin en ningún objeto
  - Test: delete lanza ForbiddenException si la sala no pertenece al admin
```

**Entregable:** CRUD de salas funcional, PIN nunca expuesto en respuestas, tests pasando.

---

## P1 · Tarea 4 — Redis module + sesión única por IP

**Duración estimada:** 1 día

**Prompt para agente de IA:**
```
En el proyecto NestJS existente, crea el módulo Redis y el sistema de sesión única:

RedisModule (global):
  - Usa ioredis con URL desde REDIS_URL del .env
  - Exporta RedisService disponible en toda la app

RedisService con estos métodos:
  - setSession(ip: string, roomId: string, nickname: string, ttlSeconds = 3600): Promise<void>
    Guarda: SET session:{ip} JSON.stringify({roomId, nickname}) EX ttlSeconds
  - getSession(ip: string): Promise<{roomId, nickname} | null>
  - deleteSession(ip: string): Promise<void>
  - addUserToRoom(roomId: string, nickname: string): Promise<void>
    Usa SADD room-users:{roomId} nickname
  - removeUserFromRoom(roomId: string, nickname: string): Promise<void>
    Usa SREM room-users:{roomId} nickname
  - getRoomUsers(roomId: string): Promise<string[]>
    Usa SMEMBERS room-users:{roomId}
  - hasNicknameInRoom(roomId: string, nickname: string): Promise<boolean>
    Usa SISMEMBER room-users:{roomId} nickname

WsSessionGuard para WebSocket:
  - Extrae IP del cliente socket (socket.handshake.address)
  - Llama RedisService.getSession(ip)
  - Si ya hay sesión en otra sala, rechaza la conexión con error 'ALREADY_IN_ROOM'
  - Si no hay sesión, permite continuar

Escribe tests para RedisService usando ioredis-mock:
  - Test: setSession guarda correctamente y expira
  - Test: getSession retorna null si no existe
  - Test: addUserToRoom y getRoomUsers son consistentes
  - Test: hasNicknameInRoom detecta duplicados
```

**Entregable:** RedisService completo, WsSessionGuard funcionando, tests pasando.

---

## P1 · Tarea 5 — Chat Gateway WebSocket (archivo más importante)

**Duración estimada:** 2 días

**Prompt para agente de IA:**
```
En el proyecto NestJS existente, crea el Chat Gateway completo con Socket.IO:

ChatGateway con @WebSocketGateway({ cors: { origin: '*' }, namespace: '/' }):

Eventos que escucha (con @SubscribeMessage):

1. 'join-room' con payload {roomId, pin, nickname}:
   - Obtiene IP del cliente: socket.handshake.address
   - Llama WsSessionGuard para verificar sesión única
   - Llama RoomsService.validatePin(roomId, pin)
   - Si pin inválido: emite error 'INVALID_PIN' al cliente
   - Verifica que nickname no esté en uso: RedisService.hasNicknameInRoom(roomId, nickname)
   - Si nickname ocupado: emite error 'NICKNAME_TAKEN'
   - Ejecuta socket.join(roomId)
   - RedisService.setSession(ip, roomId, nickname)
   - RedisService.addUserToRoom(roomId, nickname)
   - Guarda en socket.data: {roomId, nickname, ip}
   - Emite a toda la sala: 'user-joined' con {nickname, users: await getRoomUsers(roomId)}
   - Emite confirmación al cliente: 'join-success' con {roomId, nickname}

2. 'send-message' con payload {content}:
   - Verifica socket.data.roomId existe (usuario en sala)
   - Construye mensaje: {id: uuid(), roomId, nickname, content, type: 'text', timestamp: Date.now()}
   - Guarda en MongoDB con MongooseService (inyectado)
   - Emite a toda la sala: 'new-message' con el mensaje (incluyendo al emisor)

3. 'disconnect':
   - Lee socket.data.{roomId, nickname, ip}
   - RedisService.deleteSession(ip)
   - RedisService.removeUserFromRoom(roomId, nickname)
   - Emite a la sala: 'user-left' con {nickname, users: await getRoomUsers(roomId)}

Además:
- Crea MongooseModule con schema Message:
    { roomId: String, nickname: String, content: String,
      type: {type: String, enum:['text','file'], default:'text'},
      fileUrl: String, timestamp: Date }
- Endpoint REST GET /rooms/:id/messages?limit=50 para cargar historial al entrar

Escribe tests en chat.gateway.spec.ts usando socket.io-mock:
  - Test: join-room con PIN correcto añade usuario a sala
  - Test: join-room con PIN incorrecto emite INVALID_PIN
  - Test: join-room con nickname duplicado emite NICKNAME_TAKEN
  - Test: send-message hace broadcast a todos en la sala
  - Test: disconnect limpia sesión en Redis y notifica sala
```

**Entregable:** Gateway WebSocket completamente funcional. Es el archivo central del proyecto.

---

## P1 · Tarea 6 — Tests unitarios y documentación de la API

**Duración estimada:** 1 día

**Prompt para agente de IA:**
```
En el proyecto NestJS existente, completa la cobertura de tests y documenta la API:

1. Asegura cobertura >= 70% ejecutando: npm run test:cov
   Añade tests faltantes en los módulos auth, rooms, redis y gateway hasta alcanzar el umbral.

2. Configura Swagger con @nestjs/swagger:
   - Decora todos los DTOs con @ApiProperty()
   - Decora todos los controllers con @ApiTags() y @ApiOperation()
   - Decora respuestas con @ApiResponse()
   - Disponible en /api/docs solo en entorno development
   - Incluye autenticación Bearer en la UI de Swagger

3. Crea el archivo docs/API.md con:
   - Tabla de todos los endpoints REST con método, ruta, auth requerida, body y respuesta
   - Tabla de todos los eventos WebSocket con nombre, dirección (cliente→server o server→cliente),
     payload y descripción
   - Ejemplos de uso con curl para los endpoints principales

4. Verifica que el GlobalValidationPipe esté configurado en main.ts con:
   whitelist: true, forbidNonWhitelisted: true, transform: true

5. Verifica que GlobalExceptionFilter esté registrado y devuelva siempre:
   { statusCode, message, timestamp, path }
```

**Entregable:** cobertura ≥ 70% demostrable, Swagger funcional, docs/API.md completo.

---

---

# PERSONA 2 — Backend Files + Infraestructura

> **Dominio:** módulo de archivos, workers, toda la infraestructura Docker y deploy.
> Archivos propios: `backend/src/files/`, `backend/src/minio/`, `docker/`, `k6/`,
> `docker-compose.yml`, `docker-compose.dev.yml`, `.github/workflows/`

---

## P2 · Tarea 1 — docker-compose completo con todos los servicios

**Duración estimada:** 1 día

**Prompt para agente de IA:**
```
Crea el docker-compose.yml completo para este proyecto de chat en tiempo real.
Debe definir exactamente estos 7 servicios en una red interna llamada 'chat-net':

1. postgres (image: postgres:16-alpine)
   - Variables: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB desde .env
   - Volumen persistente: postgres-data:/var/lib/postgresql/data
   - Healthcheck con pg_isready

2. mongodb (image: mongo:7)
   - Variables: MONGO_INITDB_ROOT_USERNAME, MONGO_INITDB_ROOT_PASSWORD
   - Volumen persistente: mongo-data:/data/db
   - Healthcheck con mongosh --eval "db.adminCommand('ping')"

3. redis (image: redis:7-alpine)
   - Comando: redis-server --appendonly yes (persistencia AOF)
   - Volumen persistente: redis-data:/data
   - Healthcheck con redis-cli ping

4. minio (image: minio/minio)
   - Command: server /data --console-address ':9001'
   - Variables: MINIO_ROOT_USER, MINIO_ROOT_PASSWORD
   - Volumen persistente: minio-data:/data
   - Puertos: 9000 (API), 9001 (consola web, solo en dev)
   - Healthcheck con curl -f http://localhost:9000/minio/health/live

5. backend (build: ./backend)
   - depends_on con condition: service_healthy para postgres, mongodb, redis, minio
   - Variables de entorno todas desde .env
   - Reinicio: unless-stopped

6. frontend (build: ./frontend)
   - depends_on: backend
   - Reinicio: unless-stopped

7. nginx (build: ./docker/nginx)
   - Puertos: 80:80 y 443:443
   - Volúmenes para certificados SSL de Certbot
   - depends_on: backend, frontend
   - Reinicio: always

Crea también docker-compose.dev.yml como override:
  - backend: monta ./backend/src como volumen para hot-reload, expone puerto 3000
  - frontend: monta ./frontend/src, expone puerto 5173
  - Añade servicio adminer (puerto 8080) para inspeccionar PostgreSQL en dev
  - Añade servicio mongo-express (puerto 8081) para inspeccionar MongoDB en dev

Crea .env.example raíz con TODAS las variables de todos los servicios.
```

**Entregable:** `docker compose up -d` levanta los 7 servicios sin errores.

---

## P2 · Tarea 2 — Configuración de Nginx con SSL

**Duración estimada:** 1 día

**Prompt para agente de IA:**
```
Crea la configuración completa de Nginx para este proyecto en docker/nginx/:

Crea docker/nginx/Dockerfile:
  FROM nginx:alpine
  COPY nginx.conf /etc/nginx/nginx.conf

Crea docker/nginx/nginx.conf con:
  - Servidor HTTP en puerto 80 que redirige todo a HTTPS
  - Servidor HTTPS en puerto 443 con:
    * ssl_certificate y ssl_certificate_key apuntando a /etc/letsencrypt/live/DOMINIO/
    * ssl_protocols TLSv1.2 TLSv1.3
    * ssl_ciphers con configuración segura moderna

  - Location /api/ que hace proxy_pass a http://backend:3000/
    * proxy_set_header Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto
    * proxy_read_timeout 300s

  - Location /socket.io/ para WebSocket:
    * proxy_pass http://backend:3000/socket.io/
    * proxy_http_version 1.1
    * proxy_set_header Upgrade $http_upgrade
    * proxy_set_header Connection "upgrade"
    * proxy_read_timeout 3600s (1 hora para conexiones WS largas)

  - Location / que sirve archivos estáticos del frontend:
    * proxy_pass http://frontend:80/
    * try_files $uri $uri/ /index.html (para React Router SPA)

  - Gzip compression habilitado para text/html, text/css, application/javascript, application/json
  - client_max_body_size 15M (para subida de archivos de hasta 10MB + overhead)

Crea docker/nginx/certbot-init.sh:
  Script bash que ejecuta certbot certonly --webroot para obtener el certificado SSL
  inicial. Incluye instrucciones comentadas para el dominio de Hostinger.

Crea frontend/nginx.conf separado para el contenedor del frontend:
  Sirve el build estático de Vite con fallback a index.html para React Router.
```

**Entregable:** Nginx enruta correctamente HTTP→HTTPS, REST, WebSocket y estáticos.

---

## P2 · Tarea 3 — Módulo de archivos con BullMQ y Worker Threads

**Duración estimada:** 2 días

**Prompt para agente de IA:**
```
En el proyecto NestJS existente, crea el módulo completo de manejo de archivos:

FilesModule que importe: BullModule.registerQueue({name:'file-processing'}), MinioModule, PrismaModule

FilesController:
  - POST /files/upload (protegido con WsSessionGuard adaptado para HTTP):
    * Usa @UseInterceptors(FileInterceptor('file', multerConfig))
    * Valida que el usuario tenga sesión activa (Redis) y que la sala sea MULTIMEDIA
    * Encola el job en BullMQ y responde inmediatamente con {jobId, status:'queued'}
  - GET /files/room/:roomId: lista archivos de la sala desde PostgreSQL

multerConfig (en files.constants.ts):
  - storage: memoryStorage() (el archivo va al buffer, no al disco)
  - limits: { fileSize: maxFileSizeBytes } leído de la sala en PostgreSQL
  - fileFilter: permite solo image/jpeg, image/png, image/gif, image/webp,
    application/pdf, text/plain. Rechaza otros con error claro.

FilesService:
  - queueUpload(file: Express.Multer.File, roomId: string, nickname: string): Promise<{jobId}>
    Añade job a BullMQ con: { buffer: file.buffer, originalname, mimetype, roomId, nickname }
  - saveMetadata(url, filename, size, mimeType, roomId): guarda en PostgreSQL FileMetadata
  - getFilesForRoom(roomId): retorna lista de FileMetadata de la sala

FileProcessor (@Processor('file-processing')) con Worker Thread:
  - @Process('upload') async processUpload(job: Job):
    1. Extrae datos del job
    2. Sube a MinIO con MinioService.uploadFile()
    3. Llama FilesService.saveMetadata()
    4. Emite evento 'new-file' a la sala via ChatGateway (inyectado)
    5. Actualiza job progress: job.progress(100)
  - Manejo de errores: si falla MinIO reintenta 3 veces (BullMQ retry config)

Configura BullModule en app.module.ts con:
  - redis connection desde REDIS_URL del .env
  - defaultJobOptions: { attempts: 3, backoff: { type:'exponential', delay:2000 } }

Escribe tests en files.service.spec.ts:
  - Test: queueUpload rechaza archivos con MIME no permitido
  - Test: queueUpload rechaza archivos que superan el maxFileSize de la sala
  - Test: saveMetadata guarda correctamente en PostgreSQL
  - Test: getFilesForRoom retorna solo archivos de esa sala
```

**Entregable:** subida de archivos funcional, procesada en background, con reintentos automáticos.

---

## P2 · Tarea 4 — MinIO module y gestión de almacenamiento

**Duración estimada:** 1 día

**Prompt para agente de IA:**
```
En el proyecto NestJS existente, crea el módulo MinIO completo:

MinioModule (global):
  - Configura el cliente usando aws-sdk v3 (@aws-sdk/client-s3):
    * endpoint: http://${MINIO_ENDPOINT}:${MINIO_PORT}
    * region: 'us-east-1' (requerido por SDK aunque no aplique)
    * credentials: { accessKeyId: MINIO_ACCESS_KEY, secretAccessKey: MINIO_SECRET_KEY }
    * forcePathStyle: true (obligatorio para MinIO)
  - En onModuleInit: verifica que existe el bucket MINIO_BUCKET, si no lo crea
    con PutBucketCommand y configura política de acceso público para lectura

MinioService:
  - uploadFile(buffer: Buffer, filename: string, mimeType: string): Promise<string>
    * Genera key única: `${Date.now()}-${uuid()}-${filename}`
    * Sube con PutObjectCommand
    * Retorna la URL pública: `http://MINIO_ENDPOINT:MINIO_PORT/MINIO_BUCKET/key`
  
  - getPresignedUrl(key: string, expirySeconds = 3600): Promise<string>
    * Genera URL firmada con GetObjectCommand y getSignedUrl
    * Útil para archivos privados si se necesita en el futuro
  
  - deleteFile(key: string): Promise<void>
    * Elimina con DeleteObjectCommand
  
  - getFileMetadata(key: string): Promise<{size, contentType, lastModified}>
    * Usa HeadObjectCommand para obtener metadata sin descargar el archivo

Crea script docker/minio/init-buckets.sh:
  - Usa mc (MinIO Client) para crear el bucket inicial y configurar política
  - Se ejecuta como parte del healthcheck inicial

Escribe tests en minio.service.spec.ts usando mocks del SDK de AWS:
  - Test: uploadFile genera key única (no repite nombres)
  - Test: uploadFile retorna URL correctamente formada
  - Test: deleteFile llama DeleteObjectCommand con key correcta
```

**Entregable:** MinIO configurado, bucket creado automáticamente, archivos servidos públicamente.

---

## P2 · Tarea 5 — GitHub Actions CI/CD y deploy en VPS Hostinger

**Duración estimada:** 1 día

**Prompt para agente de IA:**
```
Crea los pipelines de GitHub Actions y los scripts de deploy para VPS Hostinger:

.github/workflows/test.yml (se ejecuta en cada PR a main):
  - trigger: pull_request branches: [main]
  - jobs:
    test-backend:
      - runs-on: ubuntu-latest
      - services: postgres:16, mongodb:7, redis:7 (como service containers)
      - steps: checkout, setup-node:20, npm ci, npx prisma migrate deploy,
        npm run test:cov, upload coverage artifact
    test-frontend:
      - runs-on: ubuntu-latest
      - steps: checkout, setup-node:20, npm ci, npm run build (verifica que compila)

.github/workflows/deploy.yml (se ejecuta en push a main):
  - trigger: push branches: [main]
  - needs: test (no deploya si los tests fallan)
  - jobs:
    deploy:
      - Hace SSH a la VPS usando secrets: VPS_HOST, VPS_USER, VPS_SSH_KEY
      - Comandos remotos:
        1. cd /opt/chat-realtime && git pull origin main
        2. docker compose build --no-cache backend frontend
        3. docker compose up -d --no-deps backend frontend nginx
        4. docker compose exec -T backend npx prisma migrate deploy
        5. docker compose ps (verifica que todos los servicios están Up)

Crea scripts/deploy-first-time.sh para la configuración inicial del VPS:
  - Instala Docker y Docker Compose plugin
  - Crea /opt/chat-realtime con git clone
  - Crea el archivo .env con las variables de producción
  - Ejecuta docker compose up -d
  - Ejecuta certbot para obtener SSL
  - Configura cron para renovar SSL: 0 0 * * 0 certbot renew

Crea scripts/backup.sh:
  - Backup de PostgreSQL: pg_dump dentro del contenedor → comprime → guarda en /opt/backups/
  - Backup de MongoDB: mongodump dentro del contenedor
  - Backup de MinIO: copia el volumen minio-data
  - Elimina backups de más de 7 días
  - Configura en cron: 0 2 * * * /opt/scripts/backup.sh

Documenta en docs/DEPLOY.md:
  - Requisitos del VPS (mínimo 2GB RAM, 20GB disco)
  - Paso a paso desde cero hasta producción
  - Cómo añadir el dominio de Hostinger
  - Cómo ver los logs: docker compose logs -f backend
  - Cómo hacer rollback: git checkout <commit> && docker compose up -d --build
```

**Entregable:** deploy automático funcional, SSL en producción, backups configurados.

---

## P2 · Tarea 6 — Tests E2E y prueba de carga con k6

**Duración estimada:** 1 día

**Prompt para agente de IA:**
```
Crea los tests end-to-end y de carga para el sistema de chat:

backend/test/app.e2e-spec.ts:
  Flujo completo de integración usando supertest y socket.io-client real:
  
  Test suite 1 - Auth:
    - POST /auth/login con credenciales correctas → 200 + JWT
    - POST /auth/login con password incorrecta → 401
    - GET /rooms sin JWT → 401
  
  Test suite 2 - Rooms:
    - POST /rooms (con JWT) crea sala TEXT → 201 + {id, name, type} sin pin
    - POST /rooms (con JWT) crea sala MULTIMEDIA con maxFileSize → 201
    - GET /rooms lista salas sin exponer pin → 200
    - DELETE /rooms/:id elimina sala → 204
  
  Test suite 3 - WebSocket join:
    - Cliente se conecta y emite join-room con PIN correcto → recibe join-success
    - Cliente emite join-room con PIN incorrecto → recibe error INVALID_PIN
    - Segundo cliente con mismo nickname en misma sala → recibe NICKNAME_TAKEN
    - Tercer cliente en sala diferente desde misma IP → recibe ALREADY_IN_ROOM
  
  Test suite 4 - Mensajes:
    - Cliente A y B en misma sala: A envía mensaje → B recibe new-message
    - Cliente se desconecta → resto recibe user-left
  
  Configura jest-e2e.json para correr en entorno con servicios Docker

k6/load-test.js:
  Simula el escenario real de 50 usuarios simultáneos:
  
  export const options = {
    stages: [
      { duration: '30s', target: 50 },   // Sube a 50 usuarios en 30s
      { duration: '2m',  target: 50 },   // Mantiene 50 usuarios por 2 minutos
      { duration: '30s', target: 0 },    // Baja gradualmente
    ],
    thresholds: {
      http_req_duration: ['p(95)<1000'],  // 95% de requests < 1 segundo (requisito rúbrica)
      http_req_failed: ['rate<0.01'],     // Menos del 1% de errores
    },
  };
  
  Cada VU (virtual user) hace:
    1. POST /auth/login como admin (solo VU 1, resto usa el token compartido)
    2. GET /rooms para obtener lista
    3. Conecta WebSocket con socket.io-client
    4. Emite join-room con PIN de sala de prueba
    5. Loop: envía mensaje cada 2-5 segundos durante la duración del test
    6. Verifica que recibe confirmación en < 1000ms
  
  Incluye métricas custom:
    - ws_connection_time: tiempo hasta join-success
    - message_delivery_time: tiempo entre send-message y recibir new-message

k6/smoke-test.js:
  1 VU, verifica que todos los endpoints responden con códigos correctos.
  Útil para correr después de cada deploy.
```

**Entregable:** suite E2E completa, prueba de carga verificando el requisito de 50 usuarios y < 1s.

---

---

# PERSONA 3 — Frontend completo

> **Dominio:** toda la interfaz de usuario, estado global, hooks y servicios.
> Archivos propios: todo `frontend/src/`

---

## P3 · Tarea 1 — Setup del proyecto React y estructura base

**Duración estimada:** 1 día

**Prompt para agente de IA:**
```
Crea el proyecto frontend completo con React + Vite:

Inicializa con: npm create vite@latest frontend -- --template react-ts

Instala todas las dependencias:
  - socket.io-client
  - zustand
  - @tanstack/react-query @tanstack/react-query-devtools
  - react-hook-form @hookform/resolvers zod
  - axios
  - react-router-dom
  - tailwindcss @tailwindcss/vite
  - shadcn/ui (inicializa con: npx shadcn@latest init)
    Instala componentes: button, input, card, dialog, badge, toast, spinner, progress, avatar, separator
  - lucide-react (iconos)
  - date-fns (formato de fechas en mensajes)
  - clsx tailwind-merge (utilidades de clases)

Configura:
  vite.config.ts:
    - Alias @ → ./src
    - Proxy en desarrollo: /api → http://localhost:3000, /socket.io → http://localhost:3000

  tailwind.config.ts:
    - Extiende con colores custom: primary (#6366f1), success (#22c55e), danger (#ef4444)
    - Incluye paths de shadcn/ui

Crea la estructura de carpetas completa vacía con un index.ts en cada una:
  src/pages/, src/components/chat/, src/components/rooms/, src/components/ui/,
  src/store/, src/hooks/, src/services/, src/lib/, src/types/

Crea src/types/index.ts con todas las interfaces TypeScript:
  Room, Message, UploadedFile, User, RoomType (TEXT|MULTIMEDIA),
  SocketEvents (interfaces para todos los eventos WS con sus payloads),
  ApiResponse<T>, LoginCredentials, CreateRoomPayload, JoinRoomPayload

Crea src/lib/queryClient.ts, src/lib/socket.ts (singleton), src/lib/validations.ts
Crea src/main.tsx con QueryClientProvider + ReactQueryDevtools + BrowserRouter
Crea src/App.tsx con todas las rutas definidas (páginas vacías por ahora)
```

**Entregable:** proyecto React arrancando en `npm run dev`, estructura lista, tipos definidos.

---

## P3 · Tarea 2 — Estado global con Zustand y servicios API

**Duración estimada:** 1 día

**Prompt para agente de IA:**
```
En el proyecto React existente, crea el estado global y la capa de servicios:

src/store/authStore.ts con Zustand:
  State: { token: string | null, isAuthenticated: boolean }
  Actions:
    - setToken(token: string): guarda token en state y en sessionStorage
    - logout(): limpia token del state y sessionStorage
    - initFromStorage(): lee token de sessionStorage al cargar la app
  Persiste en sessionStorage (no localStorage) para que expire al cerrar el tab

src/store/chatStore.ts con Zustand:
  State: {
    currentRoom: Room | null,
    nickname: string,
    messages: Message[],
    connectedUsers: string[],
    isConnected: boolean,
    isJoining: boolean,
    joinError: string | null,
  }
  Actions:
    - setRoom(room, nickname): establece sala y nickname actuales
    - addMessage(message: Message): añade mensaje al array (máximo 200 en memoria)
    - setUsers(users: string[]): actualiza lista de conectados
    - addUser(nickname): añade usuario a la lista
    - removeUser(nickname): elimina usuario de la lista
    - setConnected(bool): actualiza estado de conexión
    - setJoining(bool): estado de carga al unirse
    - setJoinError(error): establece error de unión
    - clearRoom(): resetea todo el estado de la sala

src/services/api.ts:
  - Instancia Axios con baseURL: import.meta.env.VITE_API_URL
  - Interceptor request: añade Authorization: Bearer {token} si existe en authStore
  - Interceptor response: si 401, llama authStore.logout() y redirige a /login

src/services/roomsApi.ts con funciones tipadas:
  - login(credentials: LoginCredentials): Promise<{access_token: string}>
  - getRooms(): Promise<Room[]>
  - createRoom(data: CreateRoomPayload): Promise<Room>
  - deleteRoom(id: string): Promise<void>
  - getRoomMessages(roomId: string, limit?: number): Promise<Message[]>

src/services/filesApi.ts:
  - uploadFile(file: File, roomId: string, onProgress: (pct: number) => void): Promise<UploadedFile>
    Usa multipart/form-data con Axios y onUploadProgress para calcular el porcentaje

src/lib/validations.ts con schemas Zod:
  - loginSchema: username (string, min 1), password (string, min 8)
  - createRoomSchema: name (min 3, max 50), type (enum), pin (regex /^\d{4,10}$/)
  - joinRoomSchema: pin (regex /^\d{4,10}$/), nickname (alphanum + guión, min 2, max 20)
```

**Entregable:** estado global listo, servicios API tipados, validaciones Zod completas.

---

## P3 · Tarea 3 — Páginas del administrador

**Duración estimada:** 1 día

**Prompt para agente de IA:**
```
En el proyecto React existente, crea las páginas del administrador:

src/pages/AdminLogin.tsx:
  - Formulario centrado con card de shadcn/ui
  - Campos: username (Input), password (Input type password)
  - Usa react-hook-form + zodResolver con loginSchema
  - Al enviar: llama roomsApi.login(), guarda token en authStore, navega a /dashboard
  - Estado de loading: deshabilita botón y muestra spinner durante la petición
  - Estado de error: muestra mensaje de error con toast o Alert de shadcn
  - Si ya está autenticado (token en store), redirige directo a /dashboard
  - Diseño limpio con el nombre del sistema y logo/icono

src/pages/AdminDashboard.tsx:
  - Navbar con nombre del admin y botón logout (llama authStore.logout())
  - Usa useRooms hook (TanStack Query) para listar salas
  - Muestra salas en grid de Cards con: nombre, tipo (badge TEXT/MULTIMEDIA),
    fecha de creación formateada con date-fns, botón eliminar
  - Botón principal "Crear sala" que abre CreateRoomModal
  - Estado vacío: ilustración + "No tienes salas creadas aún"
  - Estado de carga: skeleton cards mientras carga
  - Al eliminar: confirmación con Dialog de shadcn, luego invalida query

src/components/rooms/CreateRoomModal.tsx:
  - Dialog de shadcn/ui
  - Campos: nombre (Input), tipo (RadioGroup TEXT/MULTIMEDIA),
    PIN (Input type password, muestra/oculta con toggle ojo),
    maxFileSize (solo si tipo MULTIMEDIA, Input number con slider)
  - Usa react-hook-form + zodResolver con createRoomSchema
  - Al crear: llama roomsApi.createRoom(), invalida query, cierra modal, muestra toast éxito
  - Muestra errores de validación debajo de cada campo en rojo

src/hooks/useRooms.ts:
  - useQuery para GET /rooms con queryKey ['rooms']
  - useMutation para POST /rooms con invalidación automática
  - useMutation para DELETE /rooms/:id con optimistic update (elimina localmente antes de confirmar)

Crea ProtectedRoute component:
  - Verifica authStore.isAuthenticated
  - Si no autenticado, redirige a /login
  - Wrap en App.tsx para las rutas /dashboard
```

**Entregable:** admin puede hacer login, ver sus salas, crear nuevas y eliminarlas.

---

## P3 · Tarea 4 — Página de unirse a sala y hook de WebSocket

**Duración estimada:** 1 día

**Prompt para agente de IA:**
```
En el proyecto React existente, crea la página de join y el hook central de WebSocket:

src/hooks/useSocket.ts (archivo más importante del frontend):
  - Inicializa socket desde src/lib/socket.ts (singleton con autoConnect: false)
  - Expone: { socket, connected, connect, disconnect }
  
  Función connect(roomId, pin, nickname):
    1. socket.connect()
    2. socket.emit('join-room', {roomId, pin, nickname})
    3. Escucha 'join-success': chatStore.setRoom(), chatStore.setConnected(true)
    4. Escucha error 'INVALID_PIN': chatStore.setJoinError('PIN incorrecto')
    5. Escucha error 'NICKNAME_TAKEN': chatStore.setJoinError('Nickname ya está en uso')
    6. Escucha error 'ALREADY_IN_ROOM': chatStore.setJoinError('Ya estás en otra sala')
    
  Suscripciones activas durante el chat:
    - 'new-message': chatStore.addMessage(message)
    - 'user-joined': chatStore.setUsers(users), muestra toast "{nickname} se unió"
    - 'user-left': chatStore.setUsers(users), muestra toast "{nickname} salió"
    - 'new-file': chatStore.addMessage({...message, type:'file'})
    - 'connect_error': chatStore.setJoinError('Error de conexión')
    - 'disconnect': chatStore.setConnected(false)
  
  useEffect de limpieza: desuscribe todos los eventos al desmontar
  
  Función disconnect(): socket.disconnect(), chatStore.clearRoom()

src/pages/JoinRoom.tsx:
  - Recibe roomId de los parámetros de URL: /join/:roomId
  - Formulario con campos: PIN (Input type password) y Nickname (Input)
  - Usa react-hook-form + zodResolver con joinRoomSchema
  - Al enviar: chatStore.setJoining(true), llama useSocket.connect()
  - Muestra error de chatStore.joinError debajo del formulario en tiempo real
  - Estado de carga mientras se conecta
  - Si la conexión es exitosa, navega automáticamente a /room/:roomId
  - Muestra info de la sala (nombre, tipo) cargada con TanStack Query

src/lib/socket.ts:
  export const socket = io(import.meta.env.VITE_SOCKET_URL, {
    autoConnect: false,
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });
```

**Entregable:** usuarios pueden unirse a salas con PIN y nickname, errores claros en cada caso.

---

## P3 · Tarea 5 — ChatRoom: vista principal y componentes de chat

**Duración estimada:** 2 días

**Prompt para agente de IA:**
```
En el proyecto React existente, crea la vista principal del chat y todos sus componentes:

src/pages/ChatRoom.tsx (layout principal):
  - Layout de 3 columnas en desktop, 1 columna con drawer en mobile:
    * Columna izquierda (240px): UserList
    * Columna central (flex-1): MessageList + MessageInput en la parte inferior
    * Sin columna derecha (reservada para futuras funciones)
  - Header: nombre de la sala, tipo (badge), cantidad de usuarios conectados
  - Botón "Salir" en el header: llama useSocket.disconnect(), navega a /join
  - Al montar: carga historial con roomsApi.getRoomMessages(roomId, 50)
  - Si roomId en URL no coincide con chatStore.currentRoom, redirige a /join/:roomId
  - Responsive: en mobile el UserList es un sheet/drawer que se abre con botón

src/components/chat/MessageList.tsx:
  - Lista de mensajes de chatStore.messages
  - Scroll automático al último mensaje con useEffect + useRef
  - Mensajes propios (mismo nickname): alineados a la derecha, color primario
  - Mensajes ajenos: alineados a la izquierda, color neutro
  - Cada mensaje muestra: avatar con inicial del nickname, nickname, contenido,
    hora formateada con date-fns (ej: "14:32")
  - Mensajes tipo 'file': muestra thumbnail si es imagen, o ícono PDF con link
  - Mensajes de sistema (user-joined, user-left): centrados, texto gris en cursiva
  - Agrupa mensajes consecutivos del mismo usuario (no repite avatar/nickname)
  - Indicador de "nuevos mensajes" si el usuario scrolleó hacia arriba

src/components/chat/MessageInput.tsx:
  - Input de texto con autoFocus
  - Enter para enviar, Shift+Enter para nueva línea
  - Botón de adjuntar archivo (solo visible en salas MULTIMEDIA)
  - Contador de caracteres (max 1000)
  - Estado deshabilitado si socket no está conectado
  - Al enviar: socket.emit('send-message', {content}), limpia el input

src/components/chat/FileUpload.tsx (solo salas MULTIMEDIA):
  - Área de drag & drop con border dashed
  - Click para abrir selector nativo
  - Muestra nombre, tamaño y tipo del archivo seleccionado
  - Barra de progreso con shadcn Progress mientras sube
  - Mensajes de error claros: "Archivo demasiado grande (máx 10MB)", "Tipo no permitido"
  - Usa useFileUpload hook

src/components/chat/UserList.tsx:
  - Lista de nicknames con Avatar (inicial + color aleatorio pero consistente por nombre)
  - El propio usuario marcado con "(tú)" y badge diferente
  - Contador total en el header de la lista
  - Ordenados: el propio usuario primero, resto alfabético

src/hooks/useFileUpload.ts:
  - State: { progress, isUploading, error }
  - upload(file: File): valida tipo y tamaño localmente antes de enviar,
    llama filesApi.uploadFile con callback de progreso,
    actualiza progress en tiempo real
```

**Entregable:** ChatRoom completamente funcional, responsiva, con todos los componentes integrados.

---

## P3 · Tarea 6 — Pulido final, tests y README

**Duración estimada:** 1 día

**Prompt para agente de IA:**
```
En el proyecto React existente, realiza el pulido final, tests y documentación:

1. Mejoras de UX:
   - Notificaciones toast para: unirse a sala, usuario conectado/desconectado,
     error de conexión, archivo subido exitosamente
   - Loading skeleton en MessageList mientras carga el historial
   - Indicador de "conectando..." en el header del ChatRoom
   - Favicon y meta tags (og:title, og:description) en index.html
   - Página de bienvenida en / que redirige a /join o /dashboard según rol

2. Manejo de errores global:
   - ErrorBoundary en App.tsx que muestra página de error amigable
   - Si el WebSocket pierde conexión, muestra banner "Reconectando..." y reintenta
   - Si la API no responde, muestra mensaje claro en lugar de pantalla en blanco

3. Accesibilidad básica:
   - aria-label en todos los botones de ícono
   - role="log" en MessageList (para lectores de pantalla)
   - focus-visible en todos los inputs y botones
   - Contraste de colores mínimo WCAG AA

4. Optimizaciones:
   - React.memo en MessageItem (evita re-renders innecesarios con 200 mensajes)
   - useMemo en UserList para el ordenamiento
   - Virtualización básica: solo renderiza los últimos 100 mensajes visibles

5. Crea README.md raíz del repositorio (1 punto de rúbrica):
   Secciones:
   - Descripción del proyecto con screenshot o GIF del chat
   - Arquitectura (tabla de tecnologías por capa)
   - Diagrama ASCII de la arquitectura de servicios
   - Requisitos previos (Docker, Node 20)
   - Instalación paso a paso (clonar, .env, docker compose up)
   - Variables de entorno (tabla con nombre, descripción, ejemplo)
   - Endpoints de la API (tabla)
   - Eventos WebSocket (tabla emisión y recepción)
   - Cómo correr los tests
   - Cómo hacer el deploy en VPS
   - Créditos del equipo

6. Crea .env.example del frontend con comentarios explicativos en cada variable.
```

**Entregable:** UI pulida, accesible, README completo listo para la rúbrica.

---

---

## Puntos de integración entre personas

Estos son los momentos donde el código de los tres se une. Coordinar en estas fechas:

| Punto | Cuándo | Qué se integra |
|---|---|---|
| **INT-1** | Fin semana 1 | P2 tiene docker-compose listo → P1 y P3 arrancan sus servicios contra los contenedores de P2 |
| **INT-2** | Inicio semana 2 | P1 define los eventos WebSocket definitivos (nombres y payloads) → P3 los implementa en useSocket.ts |
| **INT-3** | Mitad semana 2 | P2 tiene el endpoint POST /files/upload listo → P3 lo conecta con filesApi.ts y FileUpload.tsx |
| **INT-4** | Fin semana 2 | Todo el sistema corre junto localmente por primera vez |
| **INT-5** | Fin semana 3 | P2 hace el deploy final en VPS con el código integrado de los tres |

## Contrato de API entre P1 y P3

P1 debe comunicar a P3 estos valores exactos antes de empezar la semana 2:

```
Eventos WebSocket (cliente → servidor):
  'join-room'    { roomId: string, pin: string, nickname: string }
  'send-message' { content: string }

Eventos WebSocket (servidor → cliente):
  'join-success' { roomId: string, nickname: string }
  'new-message'  { id: string, roomId: string, nickname: string, content: string, type: 'text'|'file', fileUrl?: string, timestamp: number }
  'user-joined'  { nickname: string, users: string[] }
  'user-left'    { nickname: string, users: string[] }
  'new-file'     { id: string, roomId: string, nickname: string, fileUrl: string, filename: string, mimeType: string, timestamp: number }
  'error'        { code: 'INVALID_PIN'|'NICKNAME_TAKEN'|'ALREADY_IN_ROOM', message: string }
```
