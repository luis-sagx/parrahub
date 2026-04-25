# PROMPT PARA AGENTE DE IA — Backend Core (Persona 1)

---

## CONTEXTO DEL PROYECTO

Estás trabajando en un **Sistema de Chat en Tiempo Real con Salas Seguras** como proyecto universitario de Aplicaciones Distribuidas. Es una aplicación fullstack donde:

- Un **administrador** se loguea, crea salas de chat con un PIN y elige el tipo: TEXT (solo mensajes) o MULTIMEDIA (mensajes + archivos).
- Los **usuarios** ingresan a una sala con el PIN y un nickname único. No necesitan registrarse.
- Los mensajes se transmiten en **tiempo real** vía WebSockets.
- Cada usuario solo puede estar en **una sala a la vez** y desde **un solo dispositivo** (verificado por IP).
- El sistema usa **hilos/concurrencia** (Worker Threads + BullMQ) para escalar sin bloqueos.

---

## TU MISIÓN

Construir el **backend completo** (NestJS) que incluye:
1. Configuración base del proyecto
2. Módulo de autenticación del administrador
3. Módulo de gestión de salas
4. Módulo Redis (sesiones por IP)
5. Chat Gateway WebSocket
6. Un `docker-compose.dev.yml` temporal para levantar las bases de datos y probar todo

---

## ESTADO ACTUAL DEL REPOSITORIO

La estructura actual es:
```
proyecto1/
├── backend/          ← AQUÍ trabajas, ya existe
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── app.controller.ts
│   │   ├── app.service.ts
│   │   └── main.ts
│   ├── prisma/       ← carpeta ya existe
│   ├── test/
│   ├── nest-cli.json
│   ├── package.json  ← YA TIENE TODAS LAS DEPENDENCIAS INSTALADAS
│   ├── tsconfig.json
│   └── tsconfig.build.json
├── frontend/         ← NO toques esta carpeta
└── README.md
```

## DEPENDENCIAS YA INSTALADAS (NO instales nada más)

El `package.json` ya tiene todo lo necesario:
- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` — NestJS base
- `@nestjs/jwt` — JWT para autenticación
- `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` — WebSockets
- `@prisma/client`, `prisma` — ORM para PostgreSQL
- `bcrypt` — hasheo de contraseñas y PINs
- `ioredis` — cliente Redis
- `bullmq` — colas de trabajo (lo usará Persona 2, tú solo configuras el módulo base)
- `class-validator`, `class-transformer` — validación de DTOs
- `helmet` — seguridad HTTP
- `uuid` — generación de IDs únicos
- `jsonwebtoken` — manejo de tokens
- `multer` — subida de archivos (lo completará Persona 2)
- `minio` — almacenamiento (lo completará Persona 2)
- `rate-limiter-flexible` — rate limiting

El gestor de paquetes es **pnpm** (hay un `pnpm-lock.yaml`).

---

## ARQUITECTURA DE DATOS

El sistema usa **3 bases de datos** con responsabilidades distintas:

- **PostgreSQL 16** → datos relacionales: Admin, Room, FileMetadata
- **MongoDB 7** → mensajes de chat (alto volumen, sin JOIN)
- **Redis 7** → sesiones activas por IP, lista de usuarios conectados por sala, TTL automático

---

## PASO 1 — Configurar tsconfig.json con paths

Edita `backend/tsconfig.json` y agrega paths para imports limpios:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "paths": {
      "@auth/*": ["src/auth/*"],
      "@rooms/*": ["src/rooms/*"],
      "@gateway/*": ["src/gateway/*"],
      "@redis/*": ["src/redis/*"],
      "@prisma-service/*": ["src/prisma/*"],
      "@common/*": ["src/common/*"],
      "@mongoose/*": ["src/mongoose/*"]
    }
  }
}
```

---

## PASO 2 — Crear el archivo .env

Crea `backend/.env` con este contenido exacto:

```env
# PostgreSQL
DATABASE_URL="postgresql://chatuser:chatpassword@localhost:5432/chatdb"

# MongoDB
MONGODB_URI="mongodb://chatuser:chatpassword@localhost:27017/chatdb?authSource=admin"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET="super-secret-jwt-key-change-in-production-2024"
JWT_EXPIRES_IN="8h"

# Admin por defecto (se crea con el seed)
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="Admin1234!"

# App
PORT=3000
NODE_ENV=development
```

Crea también `backend/.env.example` con los mismos campos pero sin valores reales.

---

## PASO 3 — Schema de Prisma

Reemplaza el contenido de `backend/prisma/schema.prisma` con:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Admin {
  id        String   @id @default(uuid())
  username  String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  rooms     Room[]
}

model Room {
  id          String     @id @default(uuid())
  name        String
  pin         String
  type        RoomType   @default(TEXT)
  maxFileSize Int        @default(10)
  isActive    Boolean    @default(true)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  adminId     String
  admin       Admin      @relation(fields: [adminId], references: [id], onDelete: Cascade)
  files       FileMetadata[]
}

model FileMetadata {
  id        String   @id @default(uuid())
  filename  String
  url       String
  size      Int
  mimeType  String
  roomId    String
  room      Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

enum RoomType {
  TEXT
  MULTIMEDIA
}
```

---

## PASO 4 — Crear el seed de Prisma

Crea `backend/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'Admin1234!';

  const existing = await prisma.admin.findUnique({ where: { username } });
  if (existing) {
    console.log(`Admin "${username}" ya existe, saltando seed.`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const admin = await prisma.admin.create({
    data: { username, password: hashedPassword },
  });

  console.log(`Admin creado: ${admin.username} (id: ${admin.id})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

Agrega en `backend/package.json` dentro de `"scripts"`:
```json
"db:migrate": "prisma migrate dev",
"db:generate": "prisma generate",
"db:seed": "ts-node prisma/seed.ts",
"db:studio": "prisma studio"
```

Y agrega al final del `package.json` (fuera de scripts):
```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

---

## PASO 5 — Módulo Prisma

Crea `backend/src/prisma/prisma.module.ts`:
```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Crea `backend/src/prisma/prisma.service.ts`:
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('PostgreSQL conectado via Prisma');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('PostgreSQL desconectado');
  }
}
```

---

## PASO 6 — Módulo Redis

Crea `backend/src/redis/redis.module.ts`:
```typescript
import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
```

Crea `backend/src/redis/redis.service.ts`:
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

export interface SessionData {
  roomId: string;
  nickname: string;
  joinedAt: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    this.client.on('connect', () => this.logger.log('Redis conectado'));
    this.client.on('error', (err) => this.logger.error('Redis error:', err));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  // ── Sesiones por IP ──────────────────────────────────────────
  async setSession(ip: string, roomId: string, nickname: string, ttlSeconds = 7200): Promise<void> {
    const data: SessionData = { roomId, nickname, joinedAt: Date.now() };
    await this.client.set(`session:${ip}`, JSON.stringify(data), 'EX', ttlSeconds);
  }

  async getSession(ip: string): Promise<SessionData | null> {
    const raw = await this.client.get(`session:${ip}`);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  async deleteSession(ip: string): Promise<void> {
    await this.client.del(`session:${ip}`);
  }

  async hasActiveSession(ip: string): Promise<boolean> {
    return (await this.client.exists(`session:${ip}`)) === 1;
  }

  // ── Usuarios por sala ────────────────────────────────────────
  async addUserToRoom(roomId: string, nickname: string): Promise<void> {
    await this.client.sadd(`room-users:${roomId}`, nickname);
  }

  async removeUserFromRoom(roomId: string, nickname: string): Promise<void> {
    await this.client.srem(`room-users:${roomId}`, nickname);
  }

  async getRoomUsers(roomId: string): Promise<string[]> {
    return this.client.smembers(`room-users:${roomId}`);
  }

  async hasNicknameInRoom(roomId: string, nickname: string): Promise<boolean> {
    return (await this.client.sismember(`room-users:${roomId}`, nickname)) === 1;
  }

  async clearRoomUsers(roomId: string): Promise<void> {
    await this.client.del(`room-users:${roomId}`);
  }

  // ── Utilidad general ─────────────────────────────────────────
  getClient(): Redis {
    return this.client;
  }
}
```

---

## PASO 7 — Módulo Mongoose (MongoDB para mensajes)

Instala mongoose con pnpm:
```bash
cd backend
pnpm add @nestjs/mongoose mongoose
pnpm add -D @types/mongoose
```

Crea `backend/src/mongoose/mongoose.module.ts`:
```typescript
import { Global, Module } from '@nestjs/common';
import { MongooseModule as NestMongooseModule } from '@nestjs/mongoose';
import { MessageSchema } from './message.schema';

@Global()
@Module({
  imports: [
    NestMongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI,
      }),
    }),
    NestMongooseModule.forFeature([{ name: 'Message', schema: MessageSchema }]),
  ],
  exports: [NestMongooseModule],
})
export class AppMongooseModule {}
```

Crea `backend/src/mongoose/message.schema.ts`:
```typescript
import { Schema, Document } from 'mongoose';

export interface Message extends Document {
  roomId: string;
  nickname: string;
  content: string;
  type: 'text' | 'file';
  fileUrl?: string;
  filename?: string;
  timestamp: Date;
}

export const MessageSchema = new Schema<Message>({
  roomId:   { type: String, required: true, index: true },
  nickname: { type: String, required: true },
  content:  { type: String, required: true },
  type:     { type: String, enum: ['text', 'file'], default: 'text' },
  fileUrl:  { type: String },
  filename: { type: String },
  timestamp: { type: Date, default: Date.now },
});

MessageSchema.index({ roomId: 1, timestamp: -1 });
```

---

## PASO 8 — Módulo de Autenticación

Crea `backend/src/auth/dto/login.dto.ts`:
```typescript
import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'El usuario no puede estar vacío' })
  @MaxLength(50)
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña no puede estar vacía' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;
}
```

Crea `backend/src/auth/auth.service.ts`:
```typescript
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ access_token: string; expiresIn: string }> {
    const admin = await this.prisma.admin.findUnique({
      where: { username: dto.username },
    });

    if (!admin) {
      this.logger.warn(`Intento de login fallido para usuario: ${dto.username}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValid = await bcrypt.compare(dto.password, admin.password);
    if (!passwordValid) {
      this.logger.warn(`Password incorrecto para usuario: ${dto.username}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = { sub: admin.id, username: admin.username };
    const access_token = this.jwtService.sign(payload);
    const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

    this.logger.log(`Admin autenticado: ${admin.username}`);
    return { access_token, expiresIn };
  }

  async validateAdmin(adminId: string) {
    return this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, username: true, createdAt: true },
    });
  }
}
```

Crea `backend/src/auth/auth.guard.ts`:
```typescript
import {
  Injectable, CanActivate, ExecutionContext,
  UnauthorizedException, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    try {
      const payload = this.jwtService.verify(token);
      request['admin'] = payload;
      return true;
    } catch (err) {
      this.logger.warn(`Token inválido: ${err.message}`);
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  private extractToken(request: Request): string | null {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    return auth.split(' ')[1];
  }
}
```

Crea `backend/src/auth/auth.controller.ts`:
```typescript
import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    this.logger.log(`Intento de login: ${dto.username}`);
    return this.authService.login(dto);
  }
}
```

Crea `backend/src/auth/auth.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './auth.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET || 'fallback-secret',
        signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
```

---

## PASO 9 — Módulo de Salas

Crea `backend/src/rooms/dto/create-room.dto.ts`:
```typescript
import {
  IsString, IsNotEmpty, IsEnum, MinLength,
  MaxLength, Matches, IsOptional, IsInt, Min, Max,
} from 'class-validator';
import { RoomType } from '@prisma/client';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(50, { message: 'El nombre no puede tener más de 50 caracteres' })
  name: string;

  @IsEnum(RoomType, { message: 'El tipo debe ser TEXT o MULTIMEDIA' })
  type: RoomType;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4,10}$/, { message: 'El PIN debe tener entre 4 y 10 dígitos numéricos' })
  pin: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxFileSize?: number;
}
```

Crea `backend/src/rooms/rooms.service.ts`:
```typescript
import {
  Injectable, NotFoundException,
  ForbiddenException, Logger, ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(adminId: string, dto: CreateRoomDto) {
    const hashedPin = await bcrypt.hash(dto.pin, 10);

    const room = await this.prisma.room.create({
      data: {
        name: dto.name,
        type: dto.type,
        pin: hashedPin,
        maxFileSize: dto.maxFileSize ?? 10,
        adminId,
      },
    });

    this.logger.log(`Sala creada: "${room.name}" (${room.type}) por admin ${adminId}`);
    const { pin: _, ...roomWithoutPin } = room;
    return roomWithoutPin;
  }

  async findAll(adminId: string) {
    const rooms = await this.prisma.room.findMany({
      where: { adminId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return rooms.map(({ pin: _, ...r }) => r);
  }

  async findOne(id: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException(`Sala ${id} no encontrada`);
    const { pin: _, ...roomWithoutPin } = room;
    return roomWithoutPin;
  }

  async delete(id: string, adminId: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException(`Sala ${id} no encontrada`);
    if (room.adminId !== adminId) throw new ForbiddenException('No tienes permiso para eliminar esta sala');

    await this.prisma.room.update({
      where: { id },
      data: { isActive: false },
    });
    this.logger.log(`Sala eliminada: ${id}`);
  }

  async validatePin(roomId: string, pin: string): Promise<boolean> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room || !room.isActive) return false;
    return bcrypt.compare(pin, room.pin);
  }

  async getRoomWithPin(roomId: string) {
    return this.prisma.room.findUnique({ where: { id: roomId } });
  }
}
```

Crea `backend/src/rooms/rooms.controller.ts`:
```typescript
import {
  Controller, Get, Post, Delete,
  Body, Param, UseGuards, Request,
  HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  private readonly logger = new Logger(RoomsController.name);

  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateRoomDto, @Request() req) {
    return this.roomsService.create(req.admin.sub, dto);
  }

  @Get()
  findAll(@Request() req) {
    return this.roomsService.findAll(req.admin.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string, @Request() req) {
    return this.roomsService.delete(id, req.admin.sub);
  }
}
```

Crea `backend/src/rooms/rooms.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
```

---

## PASO 10 — Common: Pipes, Filters y Guards

Crea `backend/src/common/pipes/validation.pipe.ts`:
```typescript
import { ValidationPipe } from '@nestjs/common';

export const GlobalValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});
```

Crea `backend/src/common/filters/http-exception.filter.ts`:
```typescript
import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.getResponse()
      : 'Error interno del servidor';

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url}`, exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).json({
      statusCode: status,
      message: typeof message === 'object' && 'message' in (message as object)
        ? (message as any).message
        : message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

Crea `backend/src/common/guards/ws-session.guard.ts`:
```typescript
import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { Socket } from 'socket.io';

@Injectable()
export class WsSessionGuard implements CanActivate {
  private readonly logger = new Logger(WsSessionGuard.name);

  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const ip = client.handshake.address;
    const { roomId } = context.switchToWs().getData();

    const session = await this.redisService.getSession(ip);
    if (session && session.roomId !== roomId) {
      this.logger.warn(`IP ${ip} intentó unirse a sala ${roomId} pero ya está en ${session.roomId}`);
      client.emit('error', { code: 'ALREADY_IN_ROOM', message: 'Ya estás conectado en otra sala' });
      return false;
    }
    return true;
  }
}
```

---

## PASO 11 — Chat Gateway WebSocket

Crea `backend/src/gateway/chat.gateway.ts`:
```typescript
import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect,
  ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../redis/redis.service';
import { RoomsService } from '../rooms/rooms.service';
import { Message } from '../mongoose/message.schema';
import { WsSessionGuard } from '../common/guards/ws-session.guard';

interface JoinRoomPayload {
  roomId: string;
  pin: string;
  nickname: string;
}

interface SendMessagePayload {
  content: string;
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/',
  transports: ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly roomsService: RoomsService,
    @InjectModel('Message') private readonly messageModel: Model<Message>,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id} desde ${client.handshake.address}`);
  }

  async handleDisconnect(client: Socket) {
    const { roomId, nickname, ip } = client.data;
    if (!roomId || !nickname) return;

    await this.redisService.deleteSession(ip);
    await this.redisService.removeUserFromRoom(roomId, nickname);

    const users = await this.redisService.getRoomUsers(roomId);
    this.server.to(roomId).emit('user-left', { nickname, users });

    this.logger.log(`${nickname} desconectado de sala ${roomId}`);
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    const ip = client.handshake.address;
    const { roomId, pin, nickname } = payload;

    // 1. Verificar sesión única por IP
    const existingSession = await this.redisService.getSession(ip);
    if (existingSession && existingSession.roomId !== roomId) {
      client.emit('error', { code: 'ALREADY_IN_ROOM', message: 'Ya estás conectado en otra sala' });
      return;
    }

    // 2. Validar PIN
    const pinValid = await this.roomsService.validatePin(roomId, pin);
    if (!pinValid) {
      client.emit('error', { code: 'INVALID_PIN', message: 'PIN incorrecto o sala no encontrada' });
      return;
    }

    // 3. Validar nickname único en la sala
    const nicknameExists = await this.redisService.hasNicknameInRoom(roomId, nickname);
    if (nicknameExists) {
      client.emit('error', { code: 'NICKNAME_TAKEN', message: 'Este nickname ya está en uso en la sala' });
      return;
    }

    // 4. Unirse a la sala
    await client.join(roomId);
    await this.redisService.setSession(ip, roomId, nickname);
    await this.redisService.addUserToRoom(roomId, nickname);

    // 5. Guardar datos en el socket
    client.data = { roomId, nickname, ip };

    // 6. Cargar historial de mensajes
    const history = await this.messageModel
      .find({ roomId })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean()
      .exec();

    const users = await this.redisService.getRoomUsers(roomId);

    // 7. Notificar
    client.emit('join-success', { roomId, nickname, history: history.reverse() });
    this.server.to(roomId).emit('user-joined', { nickname, users });

    this.logger.log(`${nickname} se unió a sala ${roomId}`);
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    const { roomId, nickname } = client.data;

    if (!roomId || !nickname) {
      client.emit('error', { code: 'NOT_IN_ROOM', message: 'Debes unirte a una sala primero' });
      return;
    }

    if (!payload.content || payload.content.trim().length === 0) return;
    if (payload.content.length > 1000) {
      client.emit('error', { code: 'MESSAGE_TOO_LONG', message: 'El mensaje no puede tener más de 1000 caracteres' });
      return;
    }

    const message = {
      id: uuidv4(),
      roomId,
      nickname,
      content: payload.content.trim(),
      type: 'text' as const,
      timestamp: new Date(),
    };

    // Guardar en MongoDB (async, no bloquea el broadcast)
    this.messageModel.create(message).catch(err =>
      this.logger.error('Error guardando mensaje en MongoDB:', err)
    );

    // Broadcast inmediato a toda la sala
    this.server.to(roomId).emit('new-message', message);
  }
}
```

Crea `backend/src/gateway/gateway.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [RoomsModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class GatewayModule {}
```

---

## PASO 12 — Endpoint de historial de mensajes

En `backend/src/rooms/rooms.controller.ts`, agrega este endpoint (dentro del mismo controller, inyecta el Model de Message):

```typescript
// Agrega en el constructor de RoomsController:
// @InjectModel('Message') private readonly messageModel: Model<Message>
// Y agrega el import de InjectModel, Model, Message

@Get(':id/messages')
async getMessages(
  @Param('id') id: string,
  @Query('limit') limit = 50,
) {
  const messages = await this.messageModel
    .find({ roomId: id })
    .sort({ timestamp: -1 })
    .limit(Number(limit))
    .lean()
    .exec();
  return messages.reverse();
}
```

---

## PASO 13 — App Module principal

Reemplaza `backend/src/app.module.ts` completamente:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AppMongooseModule } from './mongoose/mongoose.module';
import { AuthModule } from './auth/auth.module';
import { RoomsModule } from './rooms/rooms.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    RedisModule,
    AppMongooseModule,
    AuthModule,
    RoomsModule,
    GatewayModule,
  ],
})
export class AppModule {}
```

Instala `@nestjs/config`:
```bash
cd backend
pnpm add @nestjs/config @nestjs/mongoose mongoose
```

---

## PASO 14 — Main.ts

Reemplaza `backend/src/main.ts` completamente:

```typescript
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalValidationPipe } from './common/pipes/validation.pipe';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Seguridad
  app.use(helmet());
  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  });

  // Prefix global para la API REST
  app.setGlobalPrefix('api');

  // Pipes y filtros globales
  app.useGlobalPipes(GlobalValidationPipe);
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Backend corriendo en http://localhost:${port}/api`);
  logger.log(`🔌 WebSocket disponible en ws://localhost:${port}`);
}

bootstrap();
```

---

## PASO 15 — Tests unitarios

Crea `backend/src/auth/auth.service.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    admin: { findUnique: jest.fn() },
  };
  const mockJwt = {
    sign: jest.fn().mockReturnValue('mock-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('login exitoso devuelve access_token', async () => {
    const hash = await bcrypt.hash('Admin1234!', 10);
    mockPrisma.admin.findUnique.mockResolvedValue({ id: '1', username: 'admin', password: hash });
    const result = await service.login({ username: 'admin', password: 'Admin1234!' });
    expect(result.access_token).toBe('mock-token');
  });

  it('lanza UnauthorizedException si el usuario no existe', async () => {
    mockPrisma.admin.findUnique.mockResolvedValue(null);
    await expect(service.login({ username: 'nadie', password: '12345678' }))
      .rejects.toThrow(UnauthorizedException);
  });

  it('lanza UnauthorizedException si la contraseña es incorrecta', async () => {
    const hash = await bcrypt.hash('Admin1234!', 10);
    mockPrisma.admin.findUnique.mockResolvedValue({ id: '1', username: 'admin', password: hash });
    await expect(service.login({ username: 'admin', password: 'wrongpassword' }))
      .rejects.toThrow(UnauthorizedException);
  });
});
```

Crea `backend/src/rooms/rooms.service.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('RoomsService', () => {
  let service: RoomsService;

  const mockPrisma = {
    room: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<RoomsService>(RoomsService);
    jest.clearAllMocks();
  });

  it('create hashea el PIN antes de guardar', async () => {
    mockPrisma.room.create.mockImplementation(async ({ data }) => ({ ...data, id: 'uuid-1' }));
    await service.create('admin-1', { name: 'Sala Test', type: 'TEXT' as any, pin: '1234' });
    const calledWith = mockPrisma.room.create.mock.calls[0][0].data;
    expect(calledWith.pin).not.toBe('1234');
    expect(await bcrypt.compare('1234', calledWith.pin)).toBe(true);
  });

  it('findAll nunca retorna el campo pin', async () => {
    mockPrisma.room.findMany.mockResolvedValue([
      { id: '1', name: 'Sala', pin: 'hashed', type: 'TEXT', adminId: 'a1', isActive: true, createdAt: new Date(), updatedAt: new Date(), maxFileSize: 10 },
    ]);
    const rooms = await service.findAll('a1');
    rooms.forEach(r => expect(r).not.toHaveProperty('pin'));
  });

  it('validatePin retorna true con PIN correcto', async () => {
    const hash = await bcrypt.hash('5678', 10);
    mockPrisma.room.findUnique.mockResolvedValue({ pin: hash, isActive: true });
    expect(await service.validatePin('room-1', '5678')).toBe(true);
  });

  it('validatePin retorna false con PIN incorrecto', async () => {
    const hash = await bcrypt.hash('5678', 10);
    mockPrisma.room.findUnique.mockResolvedValue({ pin: hash, isActive: true });
    expect(await service.validatePin('room-1', '0000')).toBe(false);
  });

  it('delete lanza ForbiddenException si la sala no pertenece al admin', async () => {
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'r1', adminId: 'otro-admin' });
    await expect(service.delete('r1', 'mi-admin')).rejects.toThrow(ForbiddenException);
  });
});
```

---

## PASO 16 — docker-compose.dev.yml (para desarrollo y pruebas)

Crea este archivo en la **raíz del repositorio** (`proyecto1/docker-compose.dev.yml`):

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: chat_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: chatuser
      POSTGRES_PASSWORD: chatpassword
      POSTGRES_DB: chatdb
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chatuser -d chatdb"]
      interval: 10s
      timeout: 5s
      retries: 5

  mongodb:
    image: mongo:7
    container_name: chat_mongodb
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: chatuser
      MONGO_INITDB_ROOT_PASSWORD: chatpassword
      MONGO_INITDB_DATABASE: chatdb
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: chat_redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Herramientas de inspección (solo dev)
  adminer:
    image: adminer
    container_name: chat_adminer
    restart: unless-stopped
    ports:
      - "8080:8080"
    depends_on:
      - postgres

  mongo-express:
    image: mongo-express
    container_name: chat_mongo_express
    restart: unless-stopped
    ports:
      - "8081:8081"
    environment:
      ME_CONFIG_MONGODB_ADMINUSERNAME: chatuser
      ME_CONFIG_MONGODB_ADMINPASSWORD: chatpassword
      ME_CONFIG_MONGODB_URL: mongodb://chatuser:chatpassword@mongodb:27017/
      ME_CONFIG_BASICAUTH: false
    depends_on:
      - mongodb

volumes:
  postgres_data:
  mongo_data:
  redis_data:
```

---

## PASO 17 — Verificación final

Una vez que hayas creado todos los archivos anteriores, ejecuta estos comandos en orden:

```bash
# 1. Levantar las bases de datos
cd proyecto1
docker compose -f docker-compose.dev.yml up -d

# 2. Esperar ~15 segundos a que los servicios estén healthy
docker compose -f docker-compose.dev.yml ps

# 3. Generar el cliente de Prisma
cd backend
pnpm db:generate

# 4. Correr las migraciones
pnpm db:migrate
# Cuando pregunte el nombre de la migración, escribe: init

# 5. Correr el seed (crea el admin)
pnpm db:seed

# 6. Correr los tests unitarios
pnpm test

# 7. Arrancar el backend en modo desarrollo
pnpm start:dev
```

Si todo está correcto deberías ver en consola:
```
🚀 Backend corriendo en http://localhost:3000/api
🔌 WebSocket disponible en ws://localhost:3000
PostgreSQL conectado via Prisma
Redis conectado
```

---

## PASO 18 — Pruebas manuales con curl

Verifica que todo funciona con estos comandos:

```bash
# 1. Login del admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin1234!"}' | jq

# Guarda el token de la respuesta anterior
TOKEN="<pega aquí el access_token>"

# 2. Crear sala de texto
curl -X POST http://localhost:3000/api/rooms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Sala General","type":"TEXT","pin":"1234"}' | jq

# 3. Crear sala multimedia
curl -X POST http://localhost:3000/api/rooms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Sala Media","type":"MULTIMEDIA","pin":"5678","maxFileSize":10}' | jq

# 4. Listar salas
curl http://localhost:3000/api/rooms \
  -H "Authorization: Bearer $TOKEN" | jq

# 5. Verificar que las herramientas de BD funcionan:
# PostgreSQL: http://localhost:8080 (Adminer) - server: postgres, user: chatuser, pass: chatpassword
# MongoDB:    http://localhost:8081 (Mongo Express)
# Redis:      redis-cli -h localhost ping
```

---

## ESTRUCTURA FINAL ESPERADA

Al terminar, `backend/src/` debe verse así:

```
src/
├── auth/
│   ├── dto/login.dto.ts
│   ├── auth.controller.ts
│   ├── auth.guard.ts
│   ├── auth.module.ts
│   ├── auth.service.ts
│   └── auth.service.spec.ts
├── rooms/
│   ├── dto/create-room.dto.ts
│   ├── rooms.controller.ts
│   ├── rooms.module.ts
│   ├── rooms.service.ts
│   └── rooms.service.spec.ts
├── gateway/
│   ├── chat.gateway.ts
│   └── gateway.module.ts
├── redis/
│   ├── redis.module.ts
│   └── redis.service.ts
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── mongoose/
│   ├── mongoose.module.ts
│   └── message.schema.ts
├── common/
│   ├── filters/http-exception.filter.ts
│   ├── guards/ws-session.guard.ts
│   └── pipes/validation.pipe.ts
├── app.module.ts
└── main.ts
```

---

## NOTAS IMPORTANTES PARA EL AGENTE

1. **NO toques** la carpeta `frontend/` bajo ninguna circunstancia.
2. **NO cambies** el `package.json` — todas las dependencias ya están instaladas.
3. El gestor de paquetes es **pnpm**, no npm ni yarn.
4. Si necesitas instalar algo extra usa `pnpm add`.
5. Los endpoints REST tienen prefijo `/api` (configurado en `main.ts`).
6. El PIN **nunca** debe aparecer en ninguna respuesta de la API.
7. Los mensajes se guardan en **MongoDB**, todo lo demás en **PostgreSQL**.
8. La sesión única por IP se maneja **solo en Redis** con TTL de 2 horas.
9. El `docker-compose.dev.yml` va en la **raíz del repositorio**, no dentro de `backend/`.
