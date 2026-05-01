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
  private client: Redis;

  onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    this.client.on('connect', () => this.logger.log('Redis conectado'));
    this.client.on('error', (err) => this.logger.error('Redis error:', err));
  }

  async onModuleDestroy() {
    await this.client.quit();
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

  // Usuarios por sala
  async addUserToRoom(roomId: string, nickname: string): Promise<void> {
    await this.client.sadd(`room-users:${roomId}`, nickname);
  }

  async removeUserFromRoom(roomId: string, nickname: string): Promise<void> {
    await this.client.srem(`room-users:${roomId}`, nickname);
  }

  async getRoomUsers(roomId: string): Promise<string[]> {
    const users = await this.client.smembers(`room-users:${roomId}`);
    return users.map((user) => String(user));
  }

  async hasNicknameInRoom(roomId: string, nickname: string): Promise<boolean> {
    return (
      (await this.client.sismember(`room-users:${roomId}`, nickname)) === 1
    );
  }

  async clearRoomUsers(roomId: string): Promise<void> {
    await this.client.del(`room-users:${roomId}`);
  }

  getClient(): Redis {
    return this.client;
  }
}
