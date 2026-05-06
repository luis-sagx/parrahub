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

interface ClientData {
  roomId?: string;
  nickname?: string;
  ip?: string;
  deviceId?: string;
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

interface LeaveRoomAck {
  ok: boolean;
}

const ALLOWED_MESSAGE_REACTIONS = new Set(['👍', '❤️', '😂', '😮', '😢', '🙏']);

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/',
  transports: ['websocket', 'polling'],
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly inactivityTimeoutMs = parseInt(
    process.env.INACTIVITY_TIMEOUT_MS || '1800000',
    10,
  );
  private inactivityTimers = new Map<string, NodeJS.Timeout>();
  private cleanupTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly redisService: RedisService,
    private readonly roomsService: RoomsService,
    @InjectModel('Message') private readonly messageModel: Model<Message>,
  ) {}

  async afterInit(server: Server) {
    this.server = server;

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

      subClient.subscribe('socket:events', (err: Error | null, count: number) => {
        if (err) {
          this.logger.error('Failed to subscribe to socket:events', err);
        } else {
          this.logger.log(
            `Worker event subscription initialized (listening on ${count} channel)`,
          );
        }
      });
    } catch (err) {
      this.logger.error(
        'Failed to initialize worker event subscription',
        err,
      );
    }
  }

  handleConnection(client: Socket) {
    const deviceId = String(client.handshake.auth?.deviceId ?? '');

    if (!deviceId) {
      client.emit('error', {
        code: 'MISSING_DEVICE_ID',
        message: 'Falta deviceId en el handshake',
      });
      client.disconnect(true);
      return;
    }

    this.logger.log(
      `Cliente conectado: ${client.id} desde ${client.handshake.address} con deviceId ${deviceId}`,
    );
  }

  normalizeStoredMessage(message: Record<string, unknown>) {
    const fallbackId = String(message._id ?? message.id ?? '');
    return {
      ...message,
      id: fallbackId,
      reactions: Array.isArray(message.reactions) ? message.reactions : [],
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
    const { roomId, nickname, deviceId } = data;
    if (!roomId || !nickname || !deviceId) return;

    await this.redisService.deleteSession(deviceId);
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

    this.clearInactivityTimer(client.id);

    if (!roomId || !nickname || !deviceId) return;
    if (data.cleanedUp) return;

    this.clearCleanupTimer(deviceId);

    await this.redisService.setGrace(deviceId, { roomId, nickname });

    const cleanupTimer = setTimeout(async () => {
      const grace = await this.redisService.getGrace(deviceId);
      if (!grace) return;

      await this.redisService.deleteSession(deviceId);
      await this.redisService.deleteGrace(deviceId);
      await this.redisService.removeUserFromRoom(roomId, nickname);

      const users = await this.redisService.getRoomUsers(roomId);
      this.server.to(roomId).emit('user-left', { nickname, users });
      this.logger.log(`${nickname} desconectado de sala ${roomId}`);

      this.cleanupTimers.delete(deviceId);
    }, 30000);

    this.cleanupTimers.set(deviceId, cleanupTimer);
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    const ip = client.handshake.address;
    const deviceId = String(client.handshake.auth?.deviceId ?? '');
    const { roomId, pin, nickname } = payload;

    if (!deviceId) {
      client.emit('error', {
        code: 'MISSING_DEVICE_ID',
        message: 'Falta deviceId en el handshake',
      });
      return;
    }

    const grace = await this.redisService.getGrace(deviceId);
    if (grace && grace.roomId === roomId && grace.nickname === nickname) {
      this.clearCleanupTimer(deviceId);
      await this.redisService.deleteGrace(deviceId);

      const room = await this.roomsService.findOne(roomId);

      await client.join(roomId);
      await this.redisService.setSession(deviceId, roomId, nickname);
      await this.redisService.addUserToRoom(roomId, nickname);

      const clientData: ClientData = { roomId, nickname, ip, deviceId };
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
            this.normalizeStoredMessage(
              message as unknown as Record<string, unknown>,
            ),
          ),
        users,
        reconnected: true,
      } satisfies JoinSuccessPayload);

      this.logger.log(`${nickname} se reconectó a sala ${roomId}`);
      return;
    }

    // 1. Verificar sesión única por deviceId
    const existingSession = await this.redisService.getSession(deviceId);
    if (existingSession && existingSession.roomId !== roomId) {
      client.emit('error', {
        code: 'ALREADY_IN_ROOM',
        message: 'Ya estás conectado en otra sala',
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
    await this.redisService.addUserToRoom(roomId, nickname);

    // 5. Guardar datos en el socket
    const clientData: ClientData = { roomId, nickname, ip, deviceId };
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
          this.normalizeStoredMessage(
            message as unknown as Record<string, unknown>,
          ),
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

    const content = payload.content.trim();

    if (deviceId) {
      this.clearInactivityTimer(client.id);
      this.startInactivityTimer(client, deviceId);
    }

    const message = {
      roomId,
      nickname,
      content,
      type: 'text' as const,
      reactions: [],
      timestamp: new Date(),
    };

    try {
      const storedMessage = await this.messageModel.create(message);
      this.server
        .to(roomId)
        .emit(
          'new-message',
          this.normalizeStoredMessage(
            storedMessage.toObject() as unknown as Record<string, unknown>,
          ),
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
}
