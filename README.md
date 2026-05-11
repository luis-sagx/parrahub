# ParrasHub — Sistema de Chat en Tiempo Real

> Plataforma de chat multi-sala con autenticacion de administrador, acceso por PIN y soporte para mensajes de texto y archivos multimedia.

## Tabla de contenidos

1. [Descripcion](#descripcion)
2. [Caracteristicas](#caracteristicas)
3. [Tecnologias](#tecnologias)
4. [Arquitectura](#arquitectura)
5. [Instalacion](#instalacion)
6. [Uso](#uso)
7. [Control de sesion por dispositivo](#control-de-sesion-por-dispositivo)
8. [Testing y carga](#testing-y-carga)
9. [Estructura del proyecto](#estructura-del-proyecto)

---

## Descripcion

ParrasHub permite a un administrador crear salas publicas protegidas por PIN. Los usuarios se unen con un nickname y conversan en tiempo real. En salas multimedia se permiten archivos, procesados de forma asincrona. El sistema garantiza sesiones unicas por dispositivo, previene abusos y ofrece una experiencia fluida incluso con 50 usuarios simultaneos.

## Caracteristicas

- Autenticacion de administrador con JWT.
- Salas de tipo Texto o Multimedia con PIN.
- Mensajeria en tiempo real via Socket.IO.
- Subida de archivos con cola BullMQ.
- Presencia y sesiones unicas por dispositivo.

---

## Tecnologias

### Backend

| Tecnologia | Uso |
| --- | --- |
| NestJS | Framework principal con arquitectura modular |
| Socket.IO | WebSockets y salas en tiempo real |
| Prisma + PostgreSQL | Datos relacionales (admins, salas, metadatos) |
| MongoDB + Mongoose | Mensajes de chat (alto volumen) |
| Redis + BullMQ | Sesiones, presencia y cola de jobs |
| MinIO | Almacenamiento S3-compatible |

### Frontend

| Tecnologia | Uso |
| --- | --- |
| React + Vite | UI y build rapido |
| Zustand | Estado global liviano |
| TanStack Query | Cache de datos del servidor |
| Socket.IO Client | Conexion en tiempo real |
| shadcn/ui + Tailwind | Componentes y estilos |
| Axios | HTTP + progreso de subida |

### Infraestructura

| Tecnologia | Uso |
| --- | --- |
| Docker + Docker Compose | Servicios en contenedores |
| Nginx | Reverse proxy y SSL |
| GitHub Actions | CI/CD a VPS |

---

## Requisitos Funcionales

### Requisitos Funcionales

| #        | Requisito                      | Descripción                                                                                                                                                                                                                                                                           |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RF-1** | Autenticación de Administrador | El administrador accede mediante credenciales (usuario y contraseña). Una vez autenticado, puede crear múltiples salas de chat.                                                                                                                                                       |
| **RF-2** | Creación de Salas              | Cada sala tiene un ID único (generado automáticamente) y un PIN de acceso (mínimo 4 dígitos). El administrador selecciona el tipo:<br>• **Texto**: Solo mensajes de texto<br>• **Multimedia**: Mensajes de texto + archivos (imágenes, PDFs, etc.) con límite configurable (ej. 10MB) |
| **RF-3** | Acceso de Usuarios             | Los usuarios acceden proporcionando el PIN de la sala y un nickname único dentro de la sala. No se requiere registro; el acceso es anónimo pero limitado a una sala por dispositivo.                                                                                                  |
| **RF-4** | Funcionalidades en Sala        | • Envío y recepción de mensajes en tiempo real<br>• En salas multimedia: subida y visualización de archivos<br>• Lista de usuarios conectados (visibles por nickname)<br>• Desconexión automática al cerrar el navegador o inactividad prolongada                                     |
| **RF-5** | Gestión de Concurrencia        | Utiliza hilos (threads) para manejar operaciones asíncronas:<br>• Procesamiento de autenticaciones concurrentes<br>• Transmisión de mensajes a múltiples usuarios sin bloquear<br>• Manejo de subida de archivos en paralelo                                                          |

---

## Requisitos No Funcionales

### Requisitos No Funcionales

| #         | Requisito     | Descripción                                                                                         |
| --------- | ------------- | --------------------------------------------------------------------------------------------------- |
| **RNF-1** | Tiempo Real   | Actualizaciones instantáneas de mensajes (latencia < 1 segundo)                                     |
| **RNF-2** | Escalabilidad | Soporte para al menos 50 usuarios simultáneos por sala                                              |
| **RNF-3** | Seguridad     | PINs encriptados, validación de entradas para prevenir inyecciones, sesiones únicas por dispositivo |
| **RNF-4** | Interfaz      | Frontend responsivo (web-based), diseño simple y accesible                                          |
| **RNF-5** | Documentación | README con instrucciones de instalación, uso y diagrama de arquitectura                             |

---

## Arquitectura
![alt text](docs/assets/arquitectura.png)

### Modelo de Datos

![alt text](docs/assets/modelo-datos.png)

### Diagramas de Secuencia
#### Conexión de Usuario (WebSockets)

![alt text](docs/assets/coneccion-usuario.png)

#### Flujo de Mensajes y Encriptación

![alt text](docs/assets/mensajes-encriptacion.png)

#### Subida Asíncrona de Archivos (Arquitectura Orientada a Eventos)

![alt text](docs/assets/subida-archivos.png)

### Flujo de mensajes

```
Usuario envia mensaje
       ↓
  Socket.IO recibe
       ↓
  Redis valida sesion
       ↓
  MongoDB guarda mensaje (async)
       ↓
  Socket.IO broadcast a la sala
```

### Subida de archivos

```
Usuario sube archivo
       ↓
  Multer recibe el archivo
       ↓
  BullMQ encola el job
       ↓
  Worker sube a MinIO
       ↓
  URL guardada en PostgreSQL
       ↓
  Socket.IO notifica a la sala
```

---

## Instalacion

### Requisitos

- Docker y Docker Compose
- pnpm (no npm/yarn)

### Pasos

```bash
git clone https://github.com/tu-usuario/parrahub.git
cd parrahub
cp .env.example .env
```

Editar `.env` con tus credenciales y luego:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Accesos locales

- Frontend: http://localhost:5174
- Backend API: http://localhost:3001/api
- Nginx: http://localhost:8085
- PostgreSQL: localhost:5433
- MongoDB: localhost:27018
- Redis: localhost:6380
- MinIO API: http://localhost:9002
- MinIO Console: http://localhost:9003
- Adminer: http://localhost:8082
- Mongo Express: http://localhost:8083

---

## Variables de entorno

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

---

## Uso

### Admin

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

---

## Control de sesion por dispositivo

El sistema evita multiples sesiones activas en el mismo dispositivo con dos llaves en Redis:

| Clave | Basada en | Alcance |
| --- | --- | --- |
| `device:<UUID>` | UUID en `localStorage` | Confiable en el mismo browser-perfil |
| `ip:<IP>:fp:<fingerprint>` | IP + fingerprint de hardware | Best-effort entre browsers |

### Fingerprint real usado

El fingerprint se construye con señales de hardware que no dependen de timezone:

- familia de SO
- `screen.width`
- `colorDepth`
- `navigator.maxTouchPoints`

Se calcula en el frontend y se envia en el handshake de Socket.IO como `auth.deviceFingerprint`.

### Verificacion al unirse a una sala

```
Nuevo intento de conexion
        ↓
¿Existe device:<UUID>?          → SI → ALREADY_IN_ROOM
        ↓ NO
¿Existe ip:<IP>:fp:<fp>?        → SI → ALREADY_IN_ROOM
        ↓ NO
Validar PIN → validar nickname → unir → guardar ambas claves
```

### Subida de archivos (HTTP)

El endpoint `/files/upload` valida la sesion con la misma identidad IP/fingerprint. El cliente envia `x-device-fingerprint` en cada request HTTP.

### Reconexion rapida (grace period)

Si el cliente se desconecta y vuelve antes de `DISCONNECT_GRACE_MS`, se reconecta sin expulsar al usuario.

---

## Testing y carga

```bash
# Tests backend con cobertura
docker compose exec backend pnpm run test:cov

# Tests E2E
docker compose exec backend pnpm run test:e2e

# Prueba de carga
k6 run k6/load-test.js
```

---

## Estructura del proyecto

```
parrahub/
├── backend/         # NestJS + Prisma + Socket.IO
├── frontend/        # React + Vite
├── docker/          # nginx, postgres init
├── k6/              # pruebas de carga
├── docs/            # diagramas e imagenes
├── docker-compose.yml
├── docker-compose.dev.yml
└── README.md
```
## Licencia

Este proyecto está bajo la licencia MIT. Ver [LICENSE](LICENSE).