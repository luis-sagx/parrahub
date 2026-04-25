# Instrucciones para Persona 3 - Frontend completo

Este archivo resume lo que debes hacer si eres la Persona 3 del proyecto. Tu dominio es **todo el frontend**, principalmente `frontend/src/`, y tu objetivo es construir la UI completa del chat: pantallas, estado global, hooks, servicios API, WebSocket, subida de archivos, responsive y pulido final.

## Estado actual del frontend

El proyecto `frontend/` ya existe con React + Vite + TypeScript, pero esta casi vacio:

- `frontend/src/App.tsx` solo muestra `Hello, World!`.
- `frontend/src/main.tsx` solo monta `<App />`.
- `frontend/src/index.css` solo importa Tailwind.
- No existen todavia `pages/`, `components/`, `hooks/`, `store/`, `services/`, `lib/` ni `types/`.
- Ya estan instaladas varias dependencias: `socket.io-client`, `zustand`, `@tanstack/react-query`, `react-hook-form`, `zod`, `axios`, `lucide-react`, `clsx`.
- Faltan dependencias importantes para cumplir el plan: `react-router-dom`, `@hookform/resolvers`, `date-fns` y, si se decide usar shadcn completo, los componentes/primitivas que correspondan.

## Responsabilidad de Persona 3

Debes encargarte de:

- Toda la interfaz en React.
- Estado global con Zustand.
- Integracion HTTP con Axios.
- Integracion WebSocket con `socket.io-client`.
- Validaciones de formularios con `react-hook-form` + `zod`.
- Pantallas admin: login, dashboard, crear/eliminar salas.
- Pantallas publicas: unirse a sala y chat.
- Componentes de chat: lista de mensajes, input, lista de usuarios, subida de archivos.
- Responsive design y accesibilidad basica.
- README/documentacion del frontend y pruebas de build.

## Archivos y carpetas que debes crear

Dentro de `frontend/src/`, crea esta estructura:

```text
src/
  pages/
    AdminLogin.tsx
    AdminDashboard.tsx
    JoinRoom.tsx
    ChatRoom.tsx
    NotFound.tsx
  components/
    auth/
      ProtectedRoute.tsx
    chat/
      MessageList.tsx
      MessageInput.tsx
      FileUpload.tsx
      UserList.tsx
    rooms/
      CreateRoomModal.tsx
    ui/
      componentes reutilizables simples o shadcn/ui
  store/
    authStore.ts
    chatStore.ts
  hooks/
    useRooms.ts
    useSocket.ts
    useFileUpload.ts
  services/
    api.ts
    roomsApi.ts
    filesApi.ts
  lib/
    queryClient.ts
    socket.ts
    validations.ts
  types/
    index.ts
```

## Paso 1 - Preparar dependencias y configuracion

Desde `frontend/`, instala lo que falta:

```bash
pnpm add react-router-dom @hookform/resolvers date-fns
```

Si el equipo quiere usar shadcn/ui exactamente como dice el plan, inicializalo y agrega los componentes necesarios:

```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input card dialog badge toast progress avatar separator skeleton sheet alert radio-group
```

Configura:

- `vite.config.ts`: alias `@` hacia `./src` y proxy dev para `/api` y `/socket.io` hacia `http://localhost:3000`.
- `src/main.tsx`: envolver la app con `BrowserRouter` y `QueryClientProvider`.
- `src/lib/queryClient.ts`: crear un `QueryClient`.
- `src/lib/socket.ts`: crear el singleton de Socket.IO.
- `.env.example` del frontend con:

```env
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

## Paso 2 - Definir tipos base

En `src/types/index.ts`, define como minimo:

```ts
export type RoomType = 'TEXT' | 'MULTIMEDIA'

export interface Room {
  id: string
  name: string
  type: RoomType
  maxFileSize: number
  isActive?: boolean
  createdAt: string
  updatedAt?: string
  adminId?: string
}

export interface Message {
  id: string
  roomId: string
  nickname: string
  content?: string
  type: 'text' | 'file' | 'system'
  fileUrl?: string
  filename?: string
  mimeType?: string
  timestamp: string | number | Date
}

export interface UploadedFile {
  id?: string
  filename: string
  url: string
  size: number
  mimeType: string
  roomId: string
  createdAt?: string
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface CreateRoomPayload {
  name: string
  type: RoomType
  pin: string
  maxFileSize?: number
}

export interface JoinRoomPayload {
  roomId: string
  pin: string
  nickname: string
}
```

## Paso 3 - Crear estado global

`src/store/authStore.ts`:

- `token: string | null`
- `isAuthenticated: boolean`
- `setToken(token)`: guarda token en Zustand y `sessionStorage`.
- `logout()`: limpia Zustand y `sessionStorage`.
- `initFromStorage()`: recupera token al cargar la app.

`src/store/chatStore.ts`:

- `currentRoom: Room | null`
- `nickname: string`
- `messages: Message[]`
- `connectedUsers: string[]`
- `isConnected: boolean`
- `isJoining: boolean`
- `joinError: string | null`
- acciones para setear sala, agregar mensajes, actualizar usuarios, limpiar sala y manejar errores.

Regla importante: guarda maximo 200 mensajes en memoria para no crecer sin limite.

## Paso 4 - Crear servicios API

`src/services/api.ts`:

- Crear instancia Axios con `baseURL: import.meta.env.VITE_API_URL`.
- Interceptor de request: si hay token, agregar `Authorization: Bearer <token>`.
- Interceptor de response: si llega `401`, hacer logout y mandar a `/login`.

`src/services/roomsApi.ts`:

- `login(credentials)` -> `POST /auth/login`
- `getRooms()` -> `GET /rooms`
- `getRoom(id)` -> `GET /rooms/:id`
- `createRoom(data)` -> `POST /rooms`
- `deleteRoom(id)` -> `DELETE /rooms/:id`
- `getRoomMessages(roomId)` -> `GET /rooms/:id/messages`

Ojo: en el backend actual, `RoomsController` tiene `@UseGuards(JwtAuthGuard)` para todo el controlador. Eso significa que `GET /rooms/:id` y `GET /rooms/:id/messages` podrian requerir JWT aunque el plan diga que el usuario publico debe cargar datos de sala. Debes coordinar con Persona 1 para exponer una ruta publica o ajustar el frontend para no depender de esos datos antes de entrar.

`src/services/filesApi.ts`:

- `uploadFile(file, roomId, nickname, onProgress)` -> `POST /files/upload`
- Enviar `multipart/form-data` con campos `file`, `roomId`, `nickname`.
- Usar `onUploadProgress` para calcular porcentaje.

## Paso 5 - Validaciones Zod

`src/lib/validations.ts`:

- Login:
  - `username`: requerido, maximo 50.
  - `password`: minimo 8.
- Crear sala:
  - `name`: 3 a 50 caracteres.
  - `type`: `TEXT` o `MULTIMEDIA`.
  - `pin`: regex `/^\d{4,10}$/`.
  - `maxFileSize`: 1 a 100, opcional.
- Unirse a sala:
  - `pin`: regex `/^\d{4,10}$/`.
  - `nickname`: 2 a 20 caracteres. Usa una regla simple como letras, numeros, guion y guion bajo.

## Paso 6 - Pantallas admin

`AdminLogin.tsx`:

- Formulario con usuario y password.
- `react-hook-form` + `zodResolver`.
- Al enviar, llamar `login`, guardar token y navegar a `/dashboard`.
- Si ya hay token, redirigir a `/dashboard`.
- Mostrar loading y error claro.

`AdminDashboard.tsx`:

- Proteger con `ProtectedRoute`.
- Navbar con logout.
- Listar salas con `useRooms`.
- Card por sala: nombre, tipo, fecha, boton eliminar.
- Boton para abrir `CreateRoomModal`.
- Estado vacio, loading y error.

`CreateRoomModal.tsx`:

- Formulario para nombre, tipo, PIN y `maxFileSize`.
- Si `type` es `TEXT`, ocultar `maxFileSize`.
- Si `type` es `MULTIMEDIA`, mostrar `maxFileSize`.
- Al crear sala, invalidar query `['rooms']`.

`useRooms.ts`:

- `useQuery` para listar salas.
- `useMutation` para crear.
- `useMutation` para eliminar.

## Paso 7 - WebSocket y unirse a sala

`src/lib/socket.ts`:

```ts
import { io } from 'socket.io-client'

export const socket = io(import.meta.env.VITE_SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  transports: ['websocket', 'polling'],
})
```

`src/hooks/useSocket.ts` es el archivo mas importante del frontend.

Debe escuchar y emitir estos eventos:

Cliente -> servidor:

```text
join-room    { roomId, pin, nickname }
send-message { content }
```

Servidor -> cliente:

```text
join-success { roomId, nickname, history }
new-message  { id, roomId, nickname, content, type, timestamp }
user-joined  { nickname, users }
user-left    { nickname, users }
new-file     { id, roomId, nickname, fileUrl, filename, mimeType, timestamp }
error        { code, message }
```

Codigos de error que debes manejar:

```text
INVALID_PIN
NICKNAME_TAKEN
ALREADY_IN_ROOM
NOT_IN_ROOM
MESSAGE_TOO_LONG
```

Comportamiento esperado:

- `connect(roomId, pin, nickname)` conecta socket y emite `join-room`.
- En `join-success`, guardar sala/nickname, marcar conectado, guardar `history` como mensajes y navegar a `/room/:roomId`.
- En `user-joined` y `user-left`, actualizar usuarios.
- En `new-message`, agregar mensaje.
- En `new-file`, agregar mensaje tipo archivo.
- En `error`, traducir el codigo a un mensaje claro para el usuario.
- En `disconnect`, marcar `isConnected = false`.
- Al desmontar, limpiar listeners con `socket.off(...)`.

`JoinRoom.tsx`:

- Ruta recomendada: `/join/:roomId`.
- Formulario de PIN y nickname.
- Al enviar, usar `useSocket.connect`.
- Mostrar `joinError` si el backend rechaza.
- Si entra bien, navegar a `/room/:roomId`.

## Paso 8 - ChatRoom y componentes

`ChatRoom.tsx`:

- Si no hay `currentRoom` o no esta conectado, redirigir a `/join/:roomId`.
- Header con nombre/ID de sala, tipo y cantidad de usuarios.
- Boton salir: `disconnect()` y navegar a `/join/:roomId`.
- Layout:
  - Desktop: lista de usuarios a la izquierda, mensajes al centro.
  - Mobile: lista de usuarios en drawer/sheet.

`MessageList.tsx`:

- Mostrar mensajes desde `chatStore.messages`.
- Auto-scroll al ultimo mensaje.
- Mensajes propios a la derecha.
- Mensajes ajenos a la izquierda.
- Mostrar nickname, hora y contenido.
- Para archivos, mostrar link; si es imagen, thumbnail.

`MessageInput.tsx`:

- Textarea/input.
- Enter envia, Shift+Enter hace salto de linea.
- Maximo 1000 caracteres.
- Emitir `send-message` con `{ content }`.
- Deshabilitar si no hay conexion.
- Mostrar adjuntar archivo solo si la sala es `MULTIMEDIA`.

`FileUpload.tsx`:

- Drag and drop o selector nativo.
- Validar tipo y tamano antes de subir.
- Usar `useFileUpload`.
- Mostrar barra de progreso.

`UserList.tsx`:

- Mostrar usuarios conectados.
- El usuario actual debe aparecer primero y marcado como `(tu)`.
- Ordenar el resto alfabeticamente.

## Paso 9 - Rutas de App

`App.tsx` debe tener rutas parecidas a:

```text
/              -> redirigir a /login o mostrar entrada simple
/login         -> AdminLogin
/dashboard     -> AdminDashboard protegido
/join/:roomId  -> JoinRoom
/room/:roomId  -> ChatRoom
*              -> NotFound
```

## Paso 10 - Estilo visual

Puedes basarte en `frontend/DESIGN.md`, pero adaptalo a una aplicacion funcional de chat:

- Tema oscuro profesional.
- Componentes densos y claros, no una landing page.
- Bordes suaves de 6-8px.
- Buen contraste.
- Botones con iconos de `lucide-react` cuando aplique.
- Nada de texto gigantesco innecesario dentro de paneles.
- En mobile, revisar que botones y textos no se encimen.

## Paso 11 - Integracion con Persona 1 y Persona 2

Coordina con Persona 1:

- Confirmar si `GET /rooms/:id` sera publico para que un usuario pueda ver nombre/tipo antes de entrar.
- Confirmar si `GET /rooms/:id/messages` sera publico o si el historial solo llega por `join-success.history`.
- Confirmar payload final de `join-success`, porque el backend actual devuelve `history`.
- Confirmar errores WebSocket exactos.

Coordina con Persona 2:

- Confirmar que `POST /files/upload` esta listo.
- Confirmar limite real de tamano por sala.
- Confirmar respuesta final: ahora parece `{ jobId, status: 'queued' }`.
- Confirmar evento WebSocket que avisa cuando el archivo ya quedo procesado: `new-file`.

## Paso 12 - Verificacion antes de entregar

Desde `frontend/`, corre:

```bash
pnpm lint
pnpm build
pnpm dev
```

Luego prueba manualmente:

1. Login admin.
2. Crear sala `TEXT`.
3. Crear sala `MULTIMEDIA`.
4. Eliminar sala.
5. Entrar a `/join/:roomId` con PIN incorrecto.
6. Entrar con PIN correcto.
7. Enviar mensaje.
8. Abrir dos navegadores y verificar usuarios conectados.
9. Probar nickname duplicado.
10. Probar mensaje de mas de 1000 caracteres.
11. Probar subida de archivo en sala multimedia.
12. Revisar responsive en ancho mobile.

## Orden recomendado de trabajo

1. Dependencias, rutas, tipos y estructura.
2. Zustand stores.
3. Axios services.
4. Admin login/dashboard/crear salas.
5. `useSocket` y `JoinRoom`.
6. `ChatRoom`, `MessageList`, `MessageInput`, `UserList`.
7. `FileUpload` y `useFileUpload`.
8. Responsive, errores, accesibilidad.
9. Build/lint y README.

## Entregable final de Persona 3

Al terminar, deberias poder decir:

- El frontend compila con `pnpm build`.
- El admin puede iniciar sesion.
- El admin puede crear, listar y eliminar salas.
- Un usuario puede entrar a una sala con PIN y nickname.
- El chat recibe mensajes en tiempo real.
- La lista de usuarios se actualiza cuando alguien entra o sale.
- Las salas multimedia permiten subir archivos.
- La UI funciona en desktop y mobile.
