import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
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

interface ClientData {
  roomId?: string;
  nickname?: string;
  ip?: string;
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
    this.logger.log(
      `Cliente conectado: ${client.id} desde ${client.handshake.address}`,
    );
  }

  async handleDisconnect(client: Socket) {
    const data: ClientData = client.data as ClientData;
    const roomId = data.roomId;
    const nickname = data.nickname;
    const ip = data.ip;
    if (!roomId || !nickname || !ip) return;

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
    await this.redisService.setSession(ip, roomId, nickname);
    await this.redisService.addUserToRoom(roomId, nickname);

    // 5. Guardar datos en el socket
    const clientData: ClientData = { roomId, nickname, ip };
    client.data = clientData;

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
      history: history.reverse(),
    });
    this.server.to(roomId).emit('user-joined', { nickname, users });

    this.logger.log(`${nickname} se unió a sala ${roomId}`);
  }

  @SubscribeMessage('send-message')
  handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    const data: ClientData = client.data as ClientData;
    const roomId = data.roomId ?? '';
    const nickname = data.nickname ?? '';

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
    const message = {
      id: uuidv4(),
      roomId,
      nickname,
      content,
      type: 'text' as const,
      timestamp: new Date(),
    };

    // Guardar en MongoDB (async, no bloquea el broadcast)
    this.messageModel
      .create(message)
      .catch((err: unknown) =>
        this.logger.error('Error guardando mensaje en MongoDB:', err),
      );

    // Broadcast inmediato a toda la sala
    this.server.to(roomId).emit('new-message', message);
  }
}
