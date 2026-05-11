import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RedisService } from '../redis/redis.service';
import { RoomsService } from '../rooms/rooms.service';
import { Message } from '../mongoose/message.schema';
import { EncryptionService } from '../encryption/encryption.service';

interface JoinRoomPayload {
  roomId: string;
  pin: string;
  nickname: string;
}

interface SendMessagePayload {
  content: string;
}

interface ReactToMessagePayload {
  messageId: string;
  emoji: string;
}

interface MarkMessagesSeenPayload {
  messageIds: string[];
}

interface DeleteMessagePayload {
  messageId: string;
}

interface ClientData {
  roomId?: string;
  nickname?: string;
  ip?: string;
  deviceId?: string;
  fpLockKey?: string;
  cleanedUp?: boolean;
}

interface JoinSuccessPayload {
  roomId: string;
  nickname: string;
  room?: unknown;
  history?: unknown[];
  users?: string[];
  reconnected?: boolean;
}

interface MessageSeenUpdatedPayload {
  messageId: string;
  seenBy: string[];
  participants?: string[];
}

interface LeaveRoomAck {
  ok: boolean;
}

const ALLOWED_MESSAGE_REACTIONS = new Set(['👍', '❤️', '😂', '😮', '😢', '🙏']);

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/',
  transports: ['websocket', 'polling'],
  pingInterval: 5000,
  pingTimeout: 5000,
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly inactivityTimeoutMs = parseInt(
    process.env.INACTIVITY_TIMEOUT_MS || '1800000',
    10,
  );
  private readonly presenceHeartbeatMs = parseInt(
    process.env.PRESENCE_HEARTBEAT_MS || '5000',
    10,
  );
  private readonly disconnectGraceMs = parseInt(
    process.env.DISCONNECT_GRACE_MS || '5000',
    10,
  );
  private inactivityTimers = new Map<string, NodeJS.Timeout>();
  private cleanupTimers = new Map<string, NodeJS.Timeout>();
  private presenceHeartbeatTimer?: NodeJS.Timeout;

  constructor(
    private readonly redisService: RedisService,
    private readonly roomsService: RoomsService,
    private readonly encryptionService: EncryptionService,
    @InjectModel('Message') private readonly messageModel: Model<Message>,
  ) {}

  async afterInit(server: Server) {
    this.server = server;
    this.startPresenceHeartbeat();

    try {
      // Create a Redis client for worker event subscriptions
      const redis = require('ioredis');
      const subClient = new redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        retryStrategy: (times: number) => Math.min(times * 100, 3000),
      });

      // Subscribe to worker-published socket events and re-emit to clients
      subClient.on('message', (channel: string, raw: string) => {
        if (channel !== 'socket:events') return;
        try {
          const msg = JSON.parse(raw) as {
            type: string;
            roomId?: string;
            payload?: unknown;
          };
          if (msg.roomId && msg.type) {
            this.server.to(msg.roomId).emit(msg.type, msg.payload);
            this.logger.debug(
              `Re-emitted ${msg.type} to room ${msg.roomId} (from worker)`,
            );
          }
        } catch (err) {
          this.logger.error('Error parsing socket event from Redis', err);
        }
      });

      subClient.subscribe(
        'socket:events',
        (err: Error | null, count: number) => {
          if (err) {
            this.logger.error('Failed to subscribe to socket:events', err);
          } else {
            this.logger.log(
              `Worker event subscription initialized (listening on ${count} channel)`,
            );
          }
        },
      );
    } catch (err) {
      this.logger.error('Failed to initialize worker event subscription', err);
    }
  }

  private startPresenceHeartbeat() {
    if (this.presenceHeartbeatTimer) return;

    // Refresca presencia aunque el usuario no escriba mensajes.
    this.presenceHeartbeatTimer = setInterval(() => {
      void this.refreshPresence();
    }, this.presenceHeartbeatMs);

    this.presenceHeartbeatTimer.unref?.();
  }

  private async refreshPresence() {
    const roomIds = new Set<string>();
    const sockets = this.server?.sockets?.sockets;
    if (!sockets) return;

    for (const client of sockets.values()) {
      const data = client.data as ClientData;
      if (!data?.roomId || !data.nickname || data.cleanedUp) continue;

      await this.redisService.refreshUserInRoom(data.roomId, data.nickname);
      roomIds.add(data.roomId);
    }

    for (const roomId of roomIds) {
      // Emite la lista ya podada para que el frontend no muestre usuarios fantasmas.
      const users = await this.redisService.getRoomUsers(roomId);
      this.server.to(roomId).emit('users-updated', { users });
    }
  }

  private async touchClientPresence(data: ClientData) {
    if (!data.roomId || !data.nickname || data.cleanedUp) return;

    // Cada accion del usuario tambien cuenta como heartbeat inmediato.
    await this.redisService.refreshUserInRoom(data.roomId, data.nickname);
    const users = await this.redisService.getRoomUsers(data.roomId);
    this.server.to(data.roomId).emit('users-updated', { users });
  }

  private async getActiveRoomUsers(roomId: string): Promise<string[]> {
    if (!this.server?.in) {
      return this.redisService.getRoomUsers(roomId);
    }

    const sockets = await this.server.in(roomId).fetchSockets();
    // Para vistos/participantes usamos sockets vivos, no solo Redis.
    const socketUsers = sockets
      .map((socket) => (socket.data as ClientData).nickname)
      .filter((nickname): nickname is string => Boolean(nickname));

    if (socketUsers.length > 0) {
      const users = [...new Set(socketUsers)];
      await Promise.all(
        users.map((nickname) =>
          this.redisService.refreshUserInRoom(roomId, nickname),
        ),
      );
      return users;
    }

    return this.redisService.getRoomUsers(roomId);
  }

  private getClientBaseSessionKey(client: Socket): string {
    // IP real del cliente cuando pasa por nginx; fallback a address de Socket.IO.
    const forwardedFor = client.handshake.headers?.['x-forwarded-for'];
    const ip = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0];
    return `ip:${ip?.trim() || client.handshake.address}`;
  }

  private getClientSessionKey(client: Socket): string {
    // El deviceId de localStorage es el identificador más confiable por browser-perfil:
    // es el mismo en todas las pestañas del mismo browser y distinto entre browsers/dispositivos.
    const browserDeviceId = String(client.handshake.auth?.deviceId ?? '').trim();
    return `device:${browserDeviceId}`;
  }

  private getClientFingerprintKey(client: Socket): string {
    // Llave secundaria: IP + fingerprint de hardware para bloquear mismo dispositivo en diferente browser.
    // Solo funciona cuando el fingerprint no es falsificado por privacy.resistFingerprinting.
    const fingerprint = String(client.handshake.auth?.deviceFingerprint ?? '').trim();
    if (!fingerprint) return '';
    const forwardedFor = client.handshake.headers?.['x-forwarded-for'];
    const ip = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0];
    const resolvedIp = ip?.trim() || client.handshake.address;
    return `ip:${resolvedIp}:fp:${fingerprint}`;
  }

  handleConnection(client: Socket) {
    const deviceId = String(client.handshake.auth?.deviceId ?? '');
    const sessionKey = this.getClientSessionKey(client);

    if (!deviceId) {
      client.emit('error', {
        code: 'MISSING_DEVICE_ID',
        message: 'Falta deviceId en el handshake',
      });
      client.disconnect(true);
      return;
    }

    this.logger.log(
      `Cliente conectado: ${client.id} desde ${client.handshake.address} con sessionKey ${sessionKey}`,
    );
  }

  normalizeStoredMessage(message: Record<string, unknown>) {
    const fallbackId = String(message._id ?? message.id ?? '');
    return {
      ...message,
      id: fallbackId,
      reactions: Array.isArray(message.reactions) ? message.reactions : [],
      participants: Array.isArray(message.participants)
        ? message.participants
        : [],
      seenBy: Array.isArray(message.seenBy) ? message.seenBy : [],
      deleted: Boolean(message.deleted),
    };
  }

  private clearInactivityTimer(socketId: string) {
    const timer = this.inactivityTimers.get(socketId);
    if (timer) clearTimeout(timer);
    this.inactivityTimers.delete(socketId);
  }

  private clearCleanupTimer(deviceId?: string) {
    if (!deviceId) return;
    const timer = this.cleanupTimers.get(deviceId);
    if (timer) clearTimeout(timer);
    this.cleanupTimers.delete(deviceId);
  }

  private async cleanupSocketSession(
    client: Socket,
    data: ClientData,
    options: { broadcastUserLeft: boolean },
  ) {
    const { roomId, nickname, deviceId, fpLockKey } = data;
    if (!roomId || !nickname || !deviceId) return;

    await this.redisService.deleteSession(deviceId);
    if (fpLockKey) await this.redisService.deleteSession(fpLockKey);
    await this.redisService.deleteGrace(deviceId);
    await this.redisService.removeUserFromRoom(roomId, nickname);

    if (options.broadcastUserLeft) {
      const users = await this.redisService.getRoomUsers(roomId);
      this.server.to(roomId).emit('user-left', { nickname, users });
    }

    client.data = { ...data, cleanedUp: true };
    this.logger.log(`${nickname} desconectado de sala ${roomId}`);
  }

  private startInactivityTimer(client: Socket, deviceId: string) {
    this.clearInactivityTimer(client.id);

    const timer = setTimeout(async () => {
      const data = client.data as ClientData;

      client.emit('kicked', {
        reason: 'INACTIVITY',
        message: 'Desconectado por inactividad',
      });

      await this.cleanupSocketSession(client, data, {
        broadcastUserLeft: true,
      });

      this.clearInactivityTimer(client.id);
      client.disconnect(true);
    }, this.inactivityTimeoutMs);

    this.inactivityTimers.set(client.id, timer);
  }

  async handleDisconnect(client: Socket) {
    const data: ClientData = client.data as ClientData;
    const roomId = data.roomId;
    const nickname = data.nickname;
    const deviceId = data.deviceId;
    const fpLockKey = data.fpLockKey;
    this.clearInactivityTimer(client.id);

    if (!roomId || !nickname || !deviceId) return;
    if (data.cleanedUp) return;

    this.clearCleanupTimer(deviceId);

    await this.redisService.setGrace(deviceId, { roomId, nickname });

    const cleanupTimer = setTimeout(async () => {
      const grace = await this.redisService.getGrace(deviceId);
      if (!grace) return;

      await this.redisService.deleteSession(deviceId);
      if (fpLockKey) await this.redisService.deleteSession(fpLockKey);
      await this.redisService.deleteGrace(deviceId);
      await this.redisService.removeUserFromRoom(roomId, nickname);

      const users = await this.redisService.getRoomUsers(roomId);
      this.server.to(roomId).emit('user-left', { nickname, users });
      this.logger.log(`${nickname} desconectado de sala ${roomId}`);

      this.cleanupTimers.delete(deviceId);
    }, this.disconnectGraceMs);

    this.cleanupTimers.set(deviceId, cleanupTimer);
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    const ip = client.handshake.address;
    const deviceId = this.getClientSessionKey(client);
    const browserDeviceId = String(client.handshake.auth?.deviceId ?? '');
    const fpKey = this.getClientFingerprintKey(client);
    const { roomId, pin, nickname } = payload;

    if (!browserDeviceId) {
      client.emit('error', {
        code: 'MISSING_DEVICE_ID',
        message: 'Falta deviceId en el handshake',
      });
      return;
    }

    const grace = await this.redisService.getGrace(deviceId);
    if (grace && grace.roomId === roomId && grace.nickname === nickname) {
      // Reconexion rapida tras refresh/cierre accidental: conserva la misma sesion.
      this.clearCleanupTimer(deviceId);
      await this.redisService.deleteGrace(deviceId);

      const room = await this.roomsService.findOne(roomId);

      await client.join(roomId);
      await this.redisService.setSession(deviceId, roomId, nickname);
      if (fpKey) await this.redisService.setSession(fpKey, roomId, nickname);
      await this.redisService.addUserToRoom(roomId, nickname);

      const clientData: ClientData = {
        roomId,
        nickname,
        ip,
        deviceId,
        fpLockKey: fpKey || undefined,
      };
      client.data = clientData;

      this.startInactivityTimer(client, deviceId);

      const history = await this.messageModel
        .find({ roomId })
        .sort({ timestamp: -1 })
        .limit(50)
        .lean()
        .exec();

      const users = await this.redisService.getRoomUsers(roomId);

      client.emit('join-success', {
        roomId,
        nickname,
        room,
        history: history
          .reverse()
          .map((message) =>
            this.normalizeStoredMessage({
              ...message,
              content: this.encryptionService.decrypt(message.content as string),
            } as unknown as Record<string, unknown>),
          ),
        users,
        reconnected: true,
      } satisfies JoinSuccessPayload);

      this.logger.log(`${nickname} se reconectó a sala ${roomId}`);
      return;
    }

    // 1. Verificar sesión única: por UUID de browser (confiable) y por IP+fingerprint (best-effort cross-browser).
    const existingSession =
      (await this.redisService.getSession(deviceId)) ??
      (fpKey ? await this.redisService.getSession(fpKey) : null);
    if (existingSession) {
      client.emit('error', {
        code: 'ALREADY_IN_ROOM',
        message: 'Ya tienes una sesión abierta en este dispositivo',
      });
      return;
    }

    // 2. Validar PIN
    const pinValid = await this.roomsService.validatePin(roomId, pin);
    if (!pinValid) {
      client.emit('error', {
        code: 'INVALID_PIN',
        message: 'PIN incorrecto o sala no encontrada',
      });
      return;
    }

    const room = await this.roomsService.findOne(roomId);

    // 3. Validar nickname único en la sala
    const nicknameExists = await this.redisService.hasNicknameInRoom(
      roomId,
      nickname,
    );
    if (nicknameExists) {
      client.emit('error', {
        code: 'NICKNAME_TAKEN',
        message: 'Este nickname ya está en uso en la sala',
      });
      return;
    }

    // 4. Unirse a la sala
    await client.join(roomId);
    await this.redisService.setSession(deviceId, roomId, nickname);
    if (fpKey) await this.redisService.setSession(fpKey, roomId, nickname);
    await this.redisService.addUserToRoom(roomId, nickname);

    // 5. Guardar datos en el socket
    const clientData: ClientData = {
      roomId,
      nickname,
      ip,
      deviceId,
      fpLockKey: fpKey || undefined,
    };
    client.data = clientData;

    this.startInactivityTimer(client, deviceId);

    // 6. Cargar historial de mensajes
    const history = await this.messageModel
      .find({ roomId })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean()
      .exec();

    const users = await this.redisService.getRoomUsers(roomId);

    // 7. Notificar
    client.emit('join-success', {
      roomId,
      nickname,
      room,
      history: history
        .reverse()
        .map((message) =>
          this.normalizeStoredMessage({
            ...message,
            content: this.encryptionService.decrypt(message.content as string),
          } as unknown as Record<string, unknown>),
        ),
      users,
    } satisfies JoinSuccessPayload);
    this.server.to(roomId).emit('user-joined', { nickname, users });

    this.logger.log(`${nickname} se unió a sala ${roomId}`);
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    const data: ClientData = client.data as ClientData;
    const roomId = data.roomId ?? '';
    const nickname = data.nickname ?? '';
    const deviceId = data.deviceId ?? '';

    if (!roomId || !nickname) {
      client.emit('error', {
        code: 'NOT_IN_ROOM',
        message: 'Debes unirte a una sala primero',
      });
      return;
    }

    if (!payload.content || payload.content.trim().length === 0) return;
    if (payload.content.length > 1000) {
      client.emit('error', {
        code: 'MESSAGE_TOO_LONG',
        message: 'El mensaje no puede tener más de 1000 caracteres',
      });
      return;
    }

    if (deviceId) {
      this.clearInactivityTimer(client.id);
      this.startInactivityTimer(client, deviceId);
    }

    await this.touchClientPresence(data);

    const content = payload.content.trim();
    // El contador de vistos nace con todos los usuarios conectados en este instante.
    const participants = await this.getActiveRoomUsers(roomId);

    // Encriptar contenido para almacenar en MongoDB (protegido contra acceso directo a la DB)
    const encryptedContent = this.encryptionService.encrypt(content);

    const message = {
      roomId,
      nickname,
      content: encryptedContent, // Se guarda encriptado
      type: 'text' as const,
      reactions: [],
      participants,
      seenBy: [nickname],
      timestamp: new Date(),
    };

    try {
      const storedMessage = await this.messageModel.create(message);

      // Desencriptar para enviar al cliente
      const decryptedContent = this.encryptionService.decrypt(
        storedMessage.content as string,
      );

      this.server.to(roomId).emit(
        'new-message',
        this.normalizeStoredMessage({
          ...storedMessage.toObject(),
          content: decryptedContent, // Enviar desencriptado al cliente
        } as unknown as Record<string, unknown>),
      );
    } catch (err: unknown) {
      this.logger.error('Error guardando mensaje en MongoDB:', err);
      client.emit('error', {
        code: 'MESSAGE_SAVE_FAILED',
        message: 'No se pudo guardar el mensaje',
      });
    }
  }

  @SubscribeMessage('react-message')
  async handleReactMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ReactToMessagePayload,
  ) {
    const data: ClientData = client.data as ClientData;
    const roomId = data.roomId ?? '';
    const nickname = data.nickname ?? '';
    const deviceId = data.deviceId ?? '';
    const messageId = payload.messageId?.trim();
    const emoji = payload.emoji?.trim();

    if (!roomId || !nickname) {
      client.emit('error', {
        code: 'NOT_IN_ROOM',
        message: 'Debes unirte a una sala primero',
      });
      return;
    }

    if (!messageId || !emoji || !ALLOWED_MESSAGE_REACTIONS.has(emoji)) {
      client.emit('error', {
        code: 'INVALID_REACTION',
        message: 'La reaccion no es valida',
      });
      return;
    }

    if (deviceId) {
      this.clearInactivityTimer(client.id);
      this.startInactivityTimer(client, deviceId);
    }
    await this.touchClientPresence(data);

    const message = await this.messageModel.findOne({
      roomId,
      _id: messageId,
    });
    if (!message) {
      client.emit('error', {
        code: 'MESSAGE_NOT_FOUND',
        message: 'No se encontro el mensaje',
      });
      return;
    }

    const reactions = Array.isArray(message.reactions) ? message.reactions : [];
    const reaction = reactions.find((item) => item.emoji === emoji);

    if (reaction) {
      reaction.users = reaction.users.includes(nickname)
        ? reaction.users.filter((user) => user !== nickname)
        : [...reaction.users, nickname];
    } else {
      reactions.push({ emoji, users: [nickname] });
    }

    message.reactions = reactions
      .filter((item) => item.users.length > 0)
      .map((item) => ({
        emoji: item.emoji,
        users: [...new Set(item.users)],
      }));

    await message.save();

    this.server.to(roomId).emit('message-reactions-updated', {
      messageId: String(message._id),
      reactions: message.reactions,
    });
  }

  @SubscribeMessage('mark-messages-seen')
  async handleMarkMessagesSeen(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MarkMessagesSeenPayload,
  ) {
    const data: ClientData = client.data as ClientData;
    const roomId = data.roomId ?? '';
    const nickname = data.nickname ?? '';
    const deviceId = data.deviceId ?? '';
    const messageIds = Array.isArray(payload?.messageIds)
      ? [...new Set(payload.messageIds.map((id) => String(id).trim()).filter(Boolean))]
      : [];

    if (!roomId || !nickname) {
      client.emit('error', {
        code: 'NOT_IN_ROOM',
        message: 'Debes unirte a una sala primero',
      });
      return;
    }

    if (messageIds.length === 0) return;

    if (deviceId) {
      this.clearInactivityTimer(client.id);
      this.startInactivityTimer(client, deviceId);
    }
    await this.touchClientPresence(data);

    const messages = await this.messageModel
      .find({
        roomId,
        _id: { $in: messageIds },
      })
      .exec();
    // Recalcula participantes con sockets vivos para evitar contadores 1/2, 2/3, etc. desfasados.
    const activeParticipants = await this.getActiveRoomUsers(roomId);

    for (const message of messages) {
      const currentSeenBy = Array.isArray(message.seenBy) ? message.seenBy : [];
      const currentParticipants = Array.isArray(message.participants)
        ? message.participants
        : [];
      // seenBy dice quien ya vio; participants dice contra cuantos se compara el contador.
      const nextSeenBy = [...new Set([...currentSeenBy, nickname])];
      const nextParticipants = [
        ...new Set([
          ...currentParticipants,
          ...activeParticipants,
          message.nickname,
          nickname,
        ]),
      ];

      if (
        nextSeenBy.length === currentSeenBy.length &&
        nextParticipants.length === currentParticipants.length
      ) {
        continue;
      }

      message.seenBy = nextSeenBy;
      message.participants = nextParticipants;
      await message.save();

      this.server.to(roomId).emit('message-seen-updated', {
        messageId: String(message._id),
        seenBy: nextSeenBy,
        participants: nextParticipants,
      } satisfies MessageSeenUpdatedPayload);
    }
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() _payload?: unknown,
  ): Promise<LeaveRoomAck> {
    const data: ClientData = client.data as ClientData;
    const roomId = data.roomId;
    const deviceId = data.deviceId;

    this.clearInactivityTimer(client.id);
    this.clearCleanupTimer(deviceId);

    if (!roomId || !data.nickname || !deviceId) {
      return { ok: true };
    }

    await this.cleanupSocketSession(client, data, {
      broadcastUserLeft: true,
    });

    await client.leave(roomId);
    return { ok: true };
  }

  @SubscribeMessage('delete-message')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: DeleteMessagePayload,
  ) {
    const data: ClientData = client.data as ClientData;
    const roomId = data.roomId ?? '';
    const nickname = data.nickname ?? '';
    const deviceId = data.deviceId ?? '';

    if (!roomId || !nickname) {
      client.emit('error', {
        code: 'NOT_IN_ROOM',
        message: 'Debes unirte a una sala primero',
      });
      return;
    }

    if (deviceId) {
      this.clearInactivityTimer(client.id);
      this.startInactivityTimer(client, deviceId);
    }
    await this.touchClientPresence(data);

    const messageId = payload.messageId?.trim();
    if (!messageId) {
      client.emit('error', {
        code: 'INVALID_PAYLOAD',
        message: 'ID de mensaje requerido',
      });
      return;
    }

    const message = await this.messageModel.findOne({
      roomId,
      _id: messageId,
    });

    if (!message) {
      client.emit('error', {
        code: 'MESSAGE_NOT_FOUND',
        message: 'No se encontro el mensaje',
      });
      return;
    }

    // Validate author: only the author can delete their message
    if (message.nickname !== nickname) {
      client.emit('error', {
        code: 'NOT_AUTHOR',
        message: 'No puedes eliminar un mensaje que no es tuyo',
      });
      return;
    }

    // Check if already deleted
    if (message.deleted) {
      client.emit('error', {
        code: 'ALREADY_DELETED',
        message: 'Este mensaje ya fue eliminado',
      });
      return;
    }

    // Mark message as deleted
    message.deleted = true;
    await message.save();

    // Broadcast to all users in the room
    this.server.to(roomId).emit('message-deleted', {
      messageId,
      roomId,
    });

    this.logger.log(`Mensaje ${messageId} eliminado por ${nickname} en sala ${roomId}`);
  }
}
