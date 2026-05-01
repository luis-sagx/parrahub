import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { Socket } from 'socket.io';

interface RoomData {
  roomId?: string;
}

@Injectable()
export class WsSessionGuard implements CanActivate {
  private readonly logger = new Logger(WsSessionGuard.name);

  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const deviceId = String(client.handshake.auth?.deviceId ?? '');
    const data: RoomData = context.switchToWs().getData();
    const roomId = data.roomId ?? '';

    if (!deviceId) {
      client.emit('error', {
        code: 'MISSING_DEVICE_ID',
        message: 'Falta deviceId en el handshake',
      });
      return false;
    }

    const session = await this.redisService.getSession(deviceId);
    if (session && session.roomId !== roomId) {
      this.logger.warn(
        `deviceId ${deviceId} intentó unirse a sala ${roomId} pero ya está en ${session.roomId}`,
      );
      client.emit('error', {
        code: 'ALREADY_IN_ROOM',
        message: 'Ya estás conectado en otra sala',
      });
      return false;
    }
    return true;
  }
}
