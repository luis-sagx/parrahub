# ParrHub — Sistema de Chat en Tiempo Real

> Plataforma de chat multi-sala con autenticación de administrador, gestión de salas públicas mediante PIN, y soporte para mensajes de texto y archivos multimedia.

## Tabla de Contenidos

1. [Descripción](#descripción)
2. [Tecnologías](#tecnologías)
3. [Requisitos Funcionales](#requisitos-funcionales)
4. [Requisitos No Funcionales](#requisitos-no-funcionales)
5. [Arquitectura del Sistema](#arquitectura-del-sistema)
6. [Instalación](#instalación)
7. [Uso](#uso)
8. [Estructura del Proyecto](#estructura-del-proyecto)

---

## Descripción

ParrHub es un sistema de chat en tiempo real que permite a los administradores crear múltiples salas de comunicación. Los usuarios acceden a las salas mediante un PIN único, sin necesidad de registro previo.

### Características Principales

- **Autenticación de Administrador**: Inicio de sesión seguro con credenciales (usuario/contraseña)
- **Salas de Chat**: Admins pueden crear salas de tipo Texto o Multimedia
- **Acceso Público**: Usuarios se unen con PIN y nickname (sin registro)
- **Tiempo Real**: Mensajes instantáneos con latencia < 1 segundo
- **Archivos Compartidos**: Soporte para imágenes, PDFs y otros archivos segun elija el administrador (desde 1MB hasta 100MB)
- **Gestión de Concurrencia**: Manejo de múltiples usuarios simultáneos por sala

---

## Tecnologías

### Backend

| Tecnología    | Propósito                                    |
| ------------- | -------------------------------------------- |
| **NestJS**    | Framework principal con arquitectura modular |
| **Socket.IO** | Comunicación WebSocket en tiempo real        |
| **Prisma**    | ORM para PostgreSQL                          |
| **MongoDB**   | Almacenamiento de mensajes (alto volumen)    |
| **Redis**     | Sesiones, BullMQ jobs, cache                 |
| **BullMQ**    | Cola de procesamiento asíncrono              |
| **MinIO**     | Almacenamiento de archivos (S3-compatible)   |
| **JWT**       | Autenticación de administrador               |
| **bcrypt**    | Encriptación de contraseñas y PINs           |

### Frontend

| Tecnología               | Propósito                      |
| ------------------------ | ------------------------------ |
| **React 19**             | Biblioteca UI                  |
| **Vite**                 | Bundler con hot-reload         |
| **Zustand**              | Estado global                  |
| **TanStack Query**       | Gestión de estado del servidor |
| **Socket.IO Client**     | Conexión WebSocket             |
| **shadcn/ui + Tailwind** | Componentes y estilos          |

### Infraestructura

| Tecnología         | Propósito                             |
| ------------------ | ------------------------------------- |
| **Docker**         | Contenedores para todos los servicios |
| **Nginx**          | Reverse proxy (HTTP puerto 8085)      |
| **PostgreSQL 16**  | Base de datos relacional              |
| **MongoDB 7**      | Base de datos de documentos           |
| **GitHub Actions** | CI/CD automático                      |

---

## Requisitos Funcionales

### 3.1 Requisitos Funcionales

| #        | Requisito                      | Descripción                                                                                                                                                                                                                                                                           |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RF-1** | Autenticación de Administrador | El administrador accede mediante credenciales (usuario y contraseña). Una vez autenticado, puede crear múltiples salas de chat.                                                                                                                                                       |
| **RF-2** | Creación de Salas              | Cada sala tiene un ID único (generado automáticamente) y un PIN de acceso (mínimo 4 dígitos). El administrador selecciona el tipo:<br>• **Texto**: Solo mensajes de texto<br>• **Multimedia**: Mensajes de texto + archivos (imágenes, PDFs, etc.) con límite configurable (ej. 10MB) |
| **RF-3** | Acceso de Usuarios             | Los usuarios acceden proporcionando el PIN de la sala y un nickname único dentro de la sala. No se requiere registro; el acceso es anónimo pero limitado a una sala por dispositivo.                                                                                                  |
| **RF-4** | Funcionalidades en Sala        | • Envío y recepción de mensajes en tiempo real<br>• En salas multimedia: subida y visualización de archivos<br>• Lista de usuarios conectados (visibles por nickname)<br>• Desconexión automática al cerrar el navegador o inactividad prolongada                                     |
| **RF-5** | Gestión de Concurrencia        | Utiliza hilos (threads) para manejar operaciones asíncronas:<br>• Procesamiento de autenticaciones concurrentes<br>• Transmisión de mensajes a múltiples usuarios sin bloquear<br>• Manejo de subida de archivos en paralelo                                                          |

---

## Requisitos No Funcionales

### 3.2 Requisitos No Funcionales

| #         | Requisito     | Descripción                                                                                         |
| --------- | ------------- | --------------------------------------------------------------------------------------------------- |
| **RNF-1** | Tiempo Real   | Actualizaciones instantáneas de mensajes (latencia < 1 segundo)                                     |
| **RNF-2** | Escalabilidad | Soporte para al menos 50 usuarios simultáneos por sala                                              |
| **RNF-3** | Seguridad     | PINs encriptados, validación de entradas para prevenir inyecciones, sesiones únicas por dispositivo |
| **RNF-4** | Interfaz      | Frontend responsivo (web-based), diseño simple y accesible                                          |
| **RNF-5** | Documentación | README con instrucciones de instalación, uso y diagrama de arquitectura                             |

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   USUARIOS                                       │
│                         (Web Browser - Móvil)                                    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ HTTP / WS
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              NGINX (Reverse Proxy)                                │
│                        Puerto 8085 │ HTTP │ Enrutamiento                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                    │                       │                       │
                    │ /api                  │ /socket.io            │ /
                    ▼                       ▼                       ▼
┌────────────────────────┐  ┌──────────────────────┐  ┌──────────────────────────┐
│     BACKEND (NestJS)    │  │   FRONTEND (React)   │  │    SERVICIOS INTERNOS    │
│        Puerto 3000      │  │    Puerto 5174       │  │                          │
│                        │  │                      │  │                          │
│  ┌──────────────────┐   │  │  ┌───────────────┐  │  │  ┌────────────────────┐  │
│  │   Auth Module   │   │  │  │   AdminLogin   │  │  │  │    PostgreSQL     │  │
│  │  (JWT + bcrypt) │   │  │  ├───────────────┤  │  │  │   Puerto 5433     │  │
│  └────────┬─────────┘   │  │  │ AdminDashboard │  │  │  │   Admins, Salas    │  │
│           │             │  │  ├───────────────┤  │  │  └────────────────────┘  │
│  ┌──────────────────┐   │  │  │   JoinRoom    │  │  │                          │
│  │   Rooms Module   │   │  │  ├───────────────┤  │  │  ┌────────────────────┐  │
│  │   (CRUD Salas)  │   │  │  │   ChatRoom     │  │  │  │      MongoDB       │  │
│  └────────┬─────────┘   │  │  └───────────────┘  │  │  │   Puerto 27018     │  │
│           │             │  │         │          │  │  │    Mensajes        │  │
│  ┌──────────────────┐   │  └─────────┼──────────┘  │  └────────────────────┘  │
│  │  Chat Gateway    │◄──┼────────────┘             │                          │
│  │ (Socket.IO)      │   │                           │  ┌────────────────────┐  │
│  └────────┬─────────┘   │                           │  │       Redis       │  │
│           │             │                           │  │   Puerto 6380     │  │
│  ┌──────────────────┐   │                           │  │  Sesiones, Cache  │  │
│  │  Files Module     │   │                           │  └────────────────────┘  │
│  │ (BullMQ + MinIO) │   │                           │                          │
│  └──────────────────┘   │                           │  ┌────────────────────┐  │
│                        │                           │  │       MinIO        │  │
│                        │                           │  │   Puerto 9002      │  │
│                        │                           │  │    Archivos        │  │
│                        │                           │  └────────────────────┘  │
└────────────────────────┴───────────────────────────┴──────────────────────────┘
                                        │
                                        │ Cola de Jobs
                                        ▼
                          ┌─────────────────────────┐
                          │   BullMQ Worker         │
                          │ (Procesamiento archivos)│
                          └─────────────────────────┘
```

### Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FLUJO DE MENSAJES                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Usuario envia mensaje                                                        │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ Socket.IO    │───►│ Redis        │───►│ MongoDB      │                   │
│  │ recibe       │    │ verifica     │    │ guarda       │                   │
│  │              │    │ sesión       │    │ mensaje      │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────┐                                                           │
│  │ Broadcast    │───► Todos los usuarios de la sala reciben < 100ms          │
│  │ io.to(room)  │                                                           │
│  └──────────────┘                                                           │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                              FLUJO DE ARCHIVOS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Usuario sube archivo                                                        │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ Multer       │───►│ BullMQ       │───►│ Worker       │                   │
│  │ recibe       │    │ encola job   │    │ procesa en   │                   │
│  │ multipart    │    │ (no bloquea)│    │ thread       │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│                                                │                            │
│                                                ▼                            │
│                          ┌──────────────┐    ┌──────────────┐                │
│                          │ MinIO        │───►│ PostgreSQL   │                │
│                          │ almacena     │    │ guarda URL   │                │
│                          └──────────────┘    └──────────────┘                │
│                                                │                            │
│                                                ▼                            │
│                          ┌──────────────┐                                  │
│                          │ Socket.IO    │───► Notifica a sala               │
│                          │ notifica     │                                   │
│                          └──────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Modelo de Datos

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     Admin       │       │      Room       │       │  FileMetadata   │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id: UUID (PK)   │       │ id: UUID (PK)   │       │ id: UUID (PK)   │
│ username: string│──────▶│ adminId: FK     │◀──────│ roomId: FK      │
│ password: hash  │       │ name: string    │       │ filename: string│
│ createdAt       │       │ pin: hash       │       │ mimeType: string│
└─────────────────┘       │ type: ENUM      │       │ size: number    │
                          │ createdAt       │       │ url: string     │
                          └────────┬────────┘       │ uploadedAt     │
                                   │                └─────────────────┘
                                   │ (en MongoDB)
                                   ▼
                          ┌─────────────────┐
                          │    Message      │
                          ├─────────────────┤
                          │ _id: ObjectId   │
                          │ roomId: string  │
                          │ nickname: string│
                          │ content: string │
                          │ type: string    │
                          │ timestamp       │
                          └─────────────────┘
```

---

## Instalación

### Requisitos Previos

- Docker y Docker Compose instalados
- Git
- Puerto 8085 disponible (o modificar en configuración)

### Pasos de Instalación

1. **Clonar el repositorio**

```bash
git clone https://github.com/tu-usuario/parrahub.git
cd parrahub
```

2. **Copiar archivo de variables de entorno**

```bash
cp .env.example .env
```

3. **Configurar variables de entorno**

Edita el archivo `.env` con tus credenciales:

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

# Admin por defecto
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="tu-password-seguro"

# MinIO
MINIO_ENDPOINT="localhost"
MINIO_PORT=9002
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET="chat-files"

# Frontend (prefijo VITE_ obligatorio)
VITE_API_URL="http://localhost:3001/api"
VITE_SOCKET_URL="http://localhost:3001"
```

4. **Iniciar servicios con Docker**

```bash
# Desarrollo local (hot-reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Producción
docker compose up -d --build
```

5. **Migrar base de datos (primera vez)**

```bash
docker compose exec backend pnpm run db:migrate
docker compose exec backend pnpm run db:seed
```

6. **Verificar servicios**

Accede a las siguientes URLs:

| Servicio             | URL                   |
| -------------------- | --------------------- |
| Frontend             | http://localhost:8085 |
| Adminer (PostgreSQL) | http://localhost:8082 |
| Mongo Express        | http://localhost:8083 |
| MinIO Console        | http://localhost:9003 |

---

## Uso

### Acceso como Administrador

1. Accede a http://localhost:8085
2. Ingresa con las credenciales del admin (configuradas en `.env`)
3. Desde el dashboard podrás:
   - Ver todas las salas creadas
   - Crear nuevas salas
   - Eliminar salas existentes

### Crear una Sala

1. En el Dashboard, haz clic en "Crear Sala"
2. Completa el formulario:
   - **Nombre**: Identificador de la sala
   - **Tipo**: `Texto` o `Multimedia`
   - **PIN**: Mínimo 4 dígitos (se encriptará automáticamente)
3. Guarda el PIN para compartirlo con usuarios

### Acceso como Usuario

1. En la página principal, ingresa el PIN de la sala
2. Proporciona un nickname único (máximo 20 caracteres)
3. Haz clic en "Unirse" para entrar a la sala

### Dentro de la Sala

- **Enviar mensaje**: Escribe en el campo de texto y presiona Enter
- **Ver usuarios**: Lista visible en el panel lateral
- **Subir archivos**: Solo disponible en salas multimedia
- **Salir**: Cierra el navegador o haz clic en "Salir"

### Comandos de Desarrollo

```bash
# Iniciar todo con hot-reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Tests con cobertura (70% mínimo requerido)
docker compose exec backend pnpm run test:cov

# Tests E2E
docker compose exec backend pnpm run test:e2e

# Lint
docker compose exec backend pnpm run lint

# Ver logs
docker compose logs -f backend
docker compose logs -f frontend

# Detener servicios
docker compose down

# Reiniciar servicios
docker compose restart

# Verificar conexión a PostgreSQL
postgresql://chatuser:chatpassword@localhost:5433/chatdb

# Verificar conexión a MongoDB
mongodb://chatuser:chatpassword@localhost:27018/chatdb?authSource=admin

# Verificar conexión a Redis
redis://localhost:6380
```

### Prueba de Carga

```bash
# Instalar k6 (si no está instalado)
# https://k6.io/docs/get-started/installation/

# Ejecutar prueba de 50 usuarios
k6 run k6/load-test.js
```

---

## Estructura del Proyecto

```
parrahub/
├── .github/
│   └── workflows/           # CI/CD con GitHub Actions
│
├── backend/
│   ├── src/
│   │   ├── auth/             # Módulo de autenticación admin
│   │   ├── rooms/            # Módulo de gestión de salas
│   │   ├── gateway/          # Socket.IO gateway (chat en tiempo real)
│   │   ├── files/            # Módulo de archivos (BullMQ + MinIO)
│   │   ├── redis/            # Servicio de sesiones
│   │   ├── prisma/           # Servicio de base de datos
│   │   ├── minio/            # Servicio de almacenamiento
│   │   └── common/           # Pipes, filters, guards
│   ├── prisma/
│   │   ├── schema.prisma     # Modelos de datos
│   │   └── seed.ts          # Datos iniciales
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── pages/            # Páginas principales
│   │   ├── components/       # Componentes reutilizables
│   │   ├── store/            # Estado global (Zustand)
│   │   ├── hooks/            # Hooks personalizados
│   │   ├── services/        # Llamadas API
│   │   └── lib/              # Utilidades
│   └── Dockerfile
│
├── docker/
│   ├── nginx/
│   │   └── nginx.conf        # Configuración del reverse proxy
│   └── postgres/
│       └── init.sql          # Inicialización de PostgreSQL
│
├── k6/
│   ├── load-test.js          # Prueba de carga (50 usuarios)
│   └── smoke-test.js         # Prueba de sanidad
│
├── docker-compose.yml        # Servicios de producción
├── docker-compose.dev.yml   # Overrides para desarrollo
├── .env.example             # Variables de entorno
└── README.md                # Este archivo
```

---

---

## Licencia

Este proyecto está bajo la licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.
