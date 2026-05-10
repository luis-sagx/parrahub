import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';

export interface SessionData {
  roomId: string;
  nickname: string;
  joinedAt: number;
}

export interface GraceData {
  roomId: string;
  nickname: string;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  // Tiempo maximo sin heartbeat antes de sacar a un usuario de la presencia.
  private readonly roomPresenceTtlMs = parseInt(
    process.env.ROOM_PRESENCE_TTL_MS || '30000',
    10,
  );

  onModuleInit() {
    this.getRedisClient();
  }

  private getRedisClient(): Redis {
    if (this.client) {
      return this.client;
    }

    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    this.client.on('connect', () => this.logger.log('Redis conectado'));
    this.client.on('error', (err) => this.logger.error('Redis error:', err));

    return this.client;
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  // Sesiones por deviceId
  async setSession(
    deviceId: string,
    roomId: string,
    nickname: string,
    ttlSeconds = 7200,
  ): Promise<void> {
    const data: SessionData = { roomId, nickname, joinedAt: Date.now() };
    await this.client.set(
      `session:${deviceId}`,
      JSON.stringify(data),
      'EX',
      ttlSeconds,
    );
  }

  async getSession(deviceId: string): Promise<SessionData | null> {
    const raw = await this.client.get(`session:${deviceId}`);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as SessionData;
      return parsed;
    } catch {
      return null;
    }
  }

  async deleteSession(deviceId: string): Promise<void> {
    await this.client.del(`session:${deviceId}`);
  }

  async hasActiveSession(deviceId: string): Promise<boolean> {
    return (await this.client.exists(`session:${deviceId}`)) === 1;
  }

  async setGrace(
    deviceId: string,
    graceData: GraceData,
    ttlSeconds = 30,
  ): Promise<void> {
    await this.client.set(
      `grace:${deviceId}`,
      JSON.stringify(graceData),
      'EX',
      ttlSeconds,
    );
  }

  async getGrace(deviceId: string): Promise<GraceData | null> {
    const raw = await this.client.get(`grace:${deviceId}`);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as GraceData;
      return parsed;
    } catch {
      return null;
    }
  }

  async deleteGrace(deviceId: string): Promise<void> {
    await this.client.del(`grace:${deviceId}`);
  }

  // Mantiene compatibilidad con la lista anterior y refresca la presencia viva.
  async addUserToRoom(roomId: string, nickname: string): Promise<void> {
    await this.client.sadd(`room-users:${roomId}`, nickname);
    await this.refreshUserInRoom(roomId, nickname);
  }

  // Sorted set: score = ultimo heartbeat. Asi se limpian pestanas cerradas.
  async refreshUserInRoom(roomId: string, nickname: string): Promise<void> {
    await this.client.zadd(
      `room-presence:${roomId}`,
      Date.now(),
      nickname,
    );
  }

  async removeUserFromRoom(roomId: string, nickname: string): Promise<void> {
    await this.client.srem(`room-users:${roomId}`, nickname);
    await this.client.zrem(`room-presence:${roomId}`, nickname);
  }

  async getRoomUsers(roomId: string): Promise<string[]> {
    // Antes de responder, elimina usuarios cuyo socket ya no envio heartbeat.
    await this.pruneInactiveRoomUsers(roomId);
    const users = await this.client.zrange(`room-presence:${roomId}`, 0, -1);
    return users.map((user) => String(user));
  }

  async hasNicknameInRoom(roomId: string, nickname: string): Promise<boolean> {
    await this.pruneInactiveRoomUsers(roomId);
    const score = await this.client.zscore(`room-presence:${roomId}`, nickname);
    return score !== null;
  }

  async clearRoomUsers(roomId: string): Promise<void> {
    await this.client.del(`room-users:${roomId}`);
    await this.client.del(`room-presence:${roomId}`);
  }

  async pruneInactiveRoomUsers(roomId: string): Promise<void> {
    // Borra entradas viejas sin depender de que el navegador envie leave-room.
    await this.client.zremrangebyscore(
      `room-presence:${roomId}`,
      '-inf',
      Date.now() - this.roomPresenceTtlMs,
    );
  }

  async clearPresenceState(): Promise<number> {
    this.getRedisClient();

    const keys = await this.scanKeys(['session:*', 'grace:*', 'room-users:*']);

    if (keys.length === 0) {
      return 0;
    }

    await this.client.del(...keys);
    return keys.length;
  }

  private async scanKeys(patterns: string[]): Promise<string[]> {
    const keys = new Set<string>();
    const client = this.getRedisClient();

    for (const pattern of patterns) {
      let cursor = '0';

      do {
        const [nextCursor, batch] = await client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );

        cursor = nextCursor;
        batch.forEach((key) => keys.add(key));
      } while (cursor !== '0');
    }

    return [...keys];
  }

  getClient(): Redis {
    return this.getRedisClient();
  }
}
