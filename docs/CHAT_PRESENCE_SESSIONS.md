# Presencia y sesiones del chat

Este documento explica como funcionaba antes la presencia de usuarios en salas, que problema aparecio al cerrar navegadores o abrir varias sesiones, y que se cambio para corregirlo.

## Como funcionaba antes

El frontend generaba un `chat_device_id` y lo guardaba en `localStorage`.

Ese valor se enviaba al backend en dos lugares:

- En el handshake de Socket.IO, como `auth.deviceId`.
- En las peticiones HTTP de subida de archivos, como header `x-device-id`.

El backend usaba ese `deviceId` como llave de sesion en Redis:

```text
session:<deviceId>
```

Tambien guardaba los usuarios activos de una sala en un set de Redis:

```text
room-users:<roomId>
```

Cuando un usuario entraba a una sala, el backend agregaba su nickname al set. Cuando salia con el boton "Salir", el backend quitaba ese nickname del set.

## Problema 1: usuarios pegados al cerrar el navegador

El flujo funcionaba bien cuando el usuario presionaba "Salir", porque el frontend enviaba el evento `leave-room`.

Pero si el usuario cerraba la pestana, cerraba el navegador, se apagaba la conexion o el evento de desconexion no terminaba correctamente, podia pasar que el nickname quedara en:

```text
room-users:<roomId>
```

Como ese set no tenia expiracion por usuario, el usuario podia quedarse visible en la lista de "usuarios activos" aunque ya no estuviera conectado.

## Problema 2: varias pestanas o navegadores

Como `localStorage` se comparte entre pestanas del mismo navegador, dos pestanas de Firefox usaban el mismo `chat_device_id`.

Eso significaba:

- Firefox pestana 1 entraba como `usuarioA`.
- Firefox pestana 2 intentaba entrar como `usuarioB`.
- Ambas pestanas enviaban el mismo `deviceId`.
- El backend las trataba como la misma sesion.

Inicialmente se probo usar `sessionStorage`, porque eso da un identificador distinto por pestana. Eso permitia que dos pestanas del mismo navegador entren con usuarios distintos.

Pero esa no era la regla deseada. La regla final es:

```text
Una sola sesion activa por dispositivo/origen.
```

Por eso se dejo `localStorage` como estaba en el frontend.

## Cambios actuales

### 1. Presencia con vencimiento

Se agrego una presencia basada en timestamp en Redis:

```text
room-presence:<roomId>
```

Ahora, ademas del set historico `room-users:<roomId>`, cada usuario activo se registra con la hora de su ultimo latido.

El backend refresca la presencia de los sockets vivos cada pocos segundos. Si una pestana o navegador muere y deja de refrescar, Redis puede considerar ese usuario como inactivo y quitarlo de la lista.

Variables relacionadas:

```env
PRESENCE_HEARTBEAT_MS=5000
ROOM_PRESENCE_TTL_MS=12000
DISCONNECT_GRACE_MS=5000
```

Esto permite que, si un navegador se cierra sin avisar bien, el usuario desaparezca automaticamente despues de unos segundos.

### 2. Evento `users-updated`

El backend ahora puede emitir:

```text
users-updated
```

Ese evento manda la lista completa de usuarios activos. El frontend la usa para refrescar el panel de usuarios sin crear mensajes falsos de "entro" o "salio".

Los eventos `user-joined` y `user-left` siguen existiendo para mostrar mensajes de sistema cuando corresponde.

### 3. Deteccion mas rapida de desconexion

Socket.IO quedo configurado con:

```ts
pingInterval: 5000
pingTimeout: 5000
```

Antes, el servidor podia tardar mas en detectar que un navegador habia muerto. Ahora la deteccion es mas rapida.

### 4. Sesion unica por dispositivo/origen con fingerprint

El frontend conserva el `chat_device_id` en `localStorage`, pero el backend ya no depende solo de ese valor para bloquear sesiones.

Ahora el frontend calcula un `deviceFingerprint` simple usando senales del entorno del navegador:

- Zona horaria.
- Idiomas configurados.
- Plataforma.
- Cantidad de nucleos reportada por el navegador.
- Memoria del dispositivo si el navegador la expone.
- Datos de pantalla y densidad de pixeles.

Ese fingerprint se manda:

- En Socket.IO como `auth.deviceFingerprint`.
- En HTTP como header `x-device-fingerprint`.

El gateway calcula una llave de sesion combinando el origen/IP que ve el servidor con ese fingerprint:

```text
ip:<direccion>:fp:<fingerprint>
```

Ademas guarda un lock secundario solo por origen/IP:

```text
ip:<direccion>
```

Ese lock secundario es el que evita que Firefox y Chrome en la misma maquina abran dos sesiones a la vez aunque sus fingerprints sean distintos.

Esto permite que, si el mismo equipo intenta abrir otra sesion desde otro navegador, el backend responda con:

```text
Ya tienes una sesion abierta en este dispositivo
```

Si el fingerprint no llega, el backend cae al modo anterior:

```text
ip:<direccion>
```

Importante: en una aplicacion web no existe una forma perfecta de identificar un "dispositivo fisico" entre navegadores. Esta solucion combina IP/origen + fingerprint simple, y mantiene un lock por IP para hacer cumplir una sola sesion por origen visible. En desarrollo local funciona para bloquear Firefox + Chrome en la misma maquina. En redes reales, dos equipos que compartan la misma IP publica podrian ser tratados como el mismo origen.

### 5. Subida de archivos

La subida de archivos tambien fue ajustada para validar la sesion con la misma llave de origen/IP que usa el WebSocket.

Antes buscaba la sesion con:

```text
x-device-id
```

Ahora calcula la llave del request:

```text
ip:<direccion>:fp:<fingerprint>
```

Asi el permiso de subir archivos queda alineado con la sesion activa real del chat.

## Resumen final

Antes:

- La presencia dependia de quitar manualmente el nickname del set de Redis.
- Si el navegador se cerraba mal, el usuario podia quedar pegado.
- La sesion unica dependia del `deviceId` del navegador.
- Firefox y Chrome podian tener IDs distintos, por lo que podian abrir sesiones separadas en el mismo equipo.

Ahora:

- La presencia tiene latido y vencimiento.
- Los usuarios muertos se limpian automaticamente.
- La lista se refresca con `users-updated`.
- El backend bloquea una segunda sesion desde el mismo origen/dispositivo visible.
- La subida de archivos usa la misma validacion de sesion que el chat.

## Como probar

1. Levantar backend y frontend:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build backend frontend
```

2. Abrir una sala desde Firefox.

3. Intentar entrar a otra sesion desde Chrome.

Resultado esperado:

```text
Ya tienes una sesion abierta en este dispositivo
```

4. Cerrar la ventana donde si estaba conectado el usuario.

Resultado esperado:

```text
El usuario desaparece de la lista de activos despues de unos segundos.
```
