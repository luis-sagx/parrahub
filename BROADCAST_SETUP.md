# Broadcast Eficiente con Hilos Concurrentes Estables

## ✅ Implementado en Issue #8

Configuración de **broadcasting eficiente** usando **Redis PUB/SUB** + **BullMQ workers** + **Socket.IO** en este proyecto.

### Cambios Realizados

#### 1. **ChatGateway** (`backend/src/gateway/chat.gateway.ts`)
- Implementó `OnGatewayInit` para inicializar suscripción a eventos desde workers
- Subscripción a canal Redis `socket:events` que recibe eventos publicados por workers
- Re-emite eventos a clientes Socket.IO correspondientes por sala
- Logs de debug para rastrear eventos re-emitidos

```typescript
// Worker publishes → Redis channel → Gateway re-emits → Socket.IO clients
subClient.on('message', (channel: string, raw: string) => {
  const msg = JSON.parse(raw);
  this.server.to(msg.roomId).emit(msg.type, msg.payload);
});
```

#### 2. **FileProcessor** (`backend/src/files/file.processor.ts`)
- Inyectó `RedisService` para publicar eventos
- Workers publican eventos `new-file` y `new-message` a Redis
- Garantiza que eventos lleguen a todos los clientes aunque el worker sea proceso separado

```typescript
// When file upload job completes:
await this.redisService.getClient().publish('socket:events', JSON.stringify({
  type: 'new-file',
  roomId,
  payload: { ...metadata, nickname }
}));
```

### Ventajas de Esta Arquitectura

| Aspecto | Beneficio |
|--------|----------|
| **Escalabilidad** | Múltiples instancias Node pueden compartir eventos vía Redis |
| **Hilos Concurrentes** | BullMQ workers procesan archivos en background sin bloquear |
| **Consistencia** | Redis PUB/SUB garantiza entrega de eventos con orden |
| **Desacoplamiento** | Workers no necesitan conocer instancia de Socket.IO |
| **Resiliencia** | Si un worker falla, evento sigue siendo publicado |

### Flujo de Datos

```
User uploads file
    ↓
Files API endpoint → BullMQ Queue
    ↓
Worker process (separado o mismo proceso)
    ↓
Procesa archivo + Publica a Redis 'socket:events'
    ↓
ChatGateway (suscrito a 'socket:events')
    ↓
Re-emite a Socket.IO → Broadcast a sala
    ↓
Clientes reciben 'new-file' en tiempo real
```

### Cómo Probar

1. **Levantá los servicios:**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

2. **Ve al frontend:** `http://localhost:5174`

3. **Loguéate y entra a una sala** (si no hay, crea una)

4. **Pruebas de broadcast:**
   - **Envía mensajes:** Todos los clientes de la sala deben recibir en tiempo real
   - **Sube un archivo:** Aparecerá `new-file` en la sala (procesado por BullMQ worker)
   - **Reacciona con emoji:** El evento `message-reactions-updated` se broadcast a todos

5. **Verifica en logs del backend:**
```bash
docker logs chat_backend -f | grep -i "re-emitted\|worker\|socket:events"
```

### Validación en Producción

Cuando escalés a múltiples instancias (ej. con Docker Swarm o K8s):

- Usa **Redis Sentinel** o **Redis Cluster** para HA
- Coloca un **balanceador de carga** (nginx, haproxy) delante de las instancias
- Clientes Socket.IO se conectarán a cualquier instancia
- Redis conectará todas las instancias automáticamente

**Resultado:** Broadcast consistente y eficiente entre procesos/máquinas.

### Notas Técnicas

- **ioredis v5:** Cliente Redis moderno con soporte PUB/SUB
- **BullMQ:** Queue basada en Redis con workers en procesos nativos de Node
- **Socket.IO:** Soporta broadcast automático con adapter (futuro: podría usar `@socket.io/redis-adapter` para alcance completo)
- **No sincrónico:** Workers publican async, gateway re-emite async → no hay bloqueo

### Próximos Pasos (Opcional)

- Implementar `@socket.io/redis-adapter` para broadcast automático entre procesos (requiere más configuración en NestJS)
- Añadir **rate limiting** por usuario en broadcast
- Monitorear latencia de eventos con métricas
