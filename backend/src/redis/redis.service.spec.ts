import { RedisService } from './redis.service';

// Create mock client
const mockClient = {
  on: jest.fn(),
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  sadd: jest.fn().mockResolvedValue(1),
  srem: jest.fn().mockResolvedValue(1),
  smembers: jest.fn().mockResolvedValue([]),
  sismember: jest.fn().mockResolvedValue(0),
  zadd: jest.fn().mockResolvedValue(1),
  zrem: jest.fn().mockResolvedValue(1),
  zrange: jest.fn().mockResolvedValue([]),
  zscore: jest.fn().mockResolvedValue(null),
  zremrangebyscore: jest.fn().mockResolvedValue(0),
  quit: jest.fn().mockResolvedValue('OK'),
};

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockClient);
});

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';

    service = new RedisService();
    // Initialize the client
    await service.onModuleInit();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Don't call destroy in tests
  });

  describe('Session Management', () => {
    it('setSession debe guardar datos de sesion', async () => {
      await service.setSession('device-1', 'room-1', 'user1', 7200);

      expect(mockClient.set).toHaveBeenCalledWith(
        'session:device-1',
        expect.any(String),
        'EX',
        7200,
      );
    });

    it('setSession usa ttlSeconds por defecto (7200) cuando no se pasa', async () => {
      await service.setSession('device-1', 'room-1', 'user1');

      expect(mockClient.set).toHaveBeenCalledWith(
        'session:device-1',
        expect.any(String),
        'EX',
        7200,
      );
    });

    it('getSession debe retornar datos de sesion', async () => {
      const mockData = { roomId: 'room-1', nickname: 'user1', joinedAt: Date.now() };
      mockClient.get.mockResolvedValue(JSON.stringify(mockData));

      const result = await service.getSession('device-1');

      expect(mockClient.get).toHaveBeenCalledWith('session:device-1');
      expect(result).toEqual(mockData);
    });

    it('getSession debe retornar null si no existe', async () => {
      mockClient.get.mockResolvedValue(null);

      const result = await service.getSession('device-1');

      expect(result).toBeNull();
    });

    it('getSession debe retornar null si el JSON es invalido', async () => {
      mockClient.get.mockResolvedValue('invalid-json');

      const result = await service.getSession('device-1');

      expect(result).toBeNull();
    });

    it('deleteSession debe eliminar sesion', async () => {
      await service.deleteSession('device-1');

      expect(mockClient.del).toHaveBeenCalledWith('session:device-1');
    });

    it('hasActiveSession debe retornar true si existe', async () => {
      mockClient.exists.mockResolvedValue(1);

      const result = await service.hasActiveSession('device-1');

      expect(result).toBe(true);
    });

    it('hasActiveSession debe retornar false si no existe', async () => {
      mockClient.exists.mockResolvedValue(0);

      const result = await service.hasActiveSession('device-1');

      expect(result).toBe(false);
    });
  });

  describe('Grace Period', () => {
    it('setGrace debe guardar datos de gracia', async () => {
      const graceData = { roomId: 'room-1', nickname: 'user1' };

      await service.setGrace('device-1', graceData, 30);

      expect(mockClient.set).toHaveBeenCalledWith(
        'grace:device-1',
        JSON.stringify(graceData),
        'EX',
        30,
      );
    });

    it('setGrace usa ttlSeconds por defecto (30) cuando no se pasa', async () => {
      const graceData = { roomId: 'room-1', nickname: 'user1' };

      await service.setGrace('device-1', graceData);

      expect(mockClient.set).toHaveBeenCalledWith(
        'grace:device-1',
        JSON.stringify(graceData),
        'EX',
        30,
      );
    });

    it('getGrace debe retornar datos de gracia', async () => {
      const mockData = { roomId: 'room-1', nickname: 'user1' };
      mockClient.get.mockResolvedValue(JSON.stringify(mockData));

      const result = await service.getGrace('device-1');

      expect(result).toEqual(mockData);
    });

    it('getGrace debe retornar null si no existe', async () => {
      mockClient.get.mockResolvedValue(null);

      const result = await service.getGrace('device-1');

      expect(result).toBeNull();
    });

    it('deleteGrace debe eliminar datos de gracia', async () => {
      await service.deleteGrace('device-1');

      expect(mockClient.del).toHaveBeenCalledWith('grace:device-1');
    });
  });

  describe('Room Users', () => {
    it('addUserToRoom debe agregar usuario a la sala', async () => {
      await service.addUserToRoom('room-1', 'user1');

      expect(mockClient.sadd).toHaveBeenCalledWith('room-users:room-1', 'user1');
      expect(mockClient.zadd).toHaveBeenCalledWith(
        'room-presence:room-1',
        expect.any(Number),
        'user1',
      );
    });

    it('removeUserFromRoom debe remover usuario de la sala', async () => {
      await service.removeUserFromRoom('room-1', 'user1');

      expect(mockClient.srem).toHaveBeenCalledWith('room-users:room-1', 'user1');
      expect(mockClient.zrem).toHaveBeenCalledWith('room-presence:room-1', 'user1');
    });

    it('getRoomUsers debe retornar lista de usuarios', async () => {
      mockClient.zrange.mockResolvedValue(['user1', 'user2']);

      const result = await service.getRoomUsers('room-1');

      expect(mockClient.zremrangebyscore).toHaveBeenCalledWith(
        'room-presence:room-1',
        '-inf',
        expect.any(Number),
      );
      expect(mockClient.zrange).toHaveBeenCalledWith('room-presence:room-1', 0, -1);
      expect(result).toEqual(['user1', 'user2']);
    });

    it('hasNicknameInRoom debe retornar true si el usuario existe', async () => {
      mockClient.zscore.mockResolvedValue(String(Date.now()));

      const result = await service.hasNicknameInRoom('room-1', 'user1');

      expect(result).toBe(true);
    });

    it('hasNicknameInRoom debe retornar false si no existe', async () => {
      mockClient.zscore.mockResolvedValue(null);

      const result = await service.hasNicknameInRoom('room-1', 'user1');

      expect(result).toBe(false);
    });

    it('clearRoomUsers debe eliminar todos los usuarios de la sala', async () => {
      await service.clearRoomUsers('room-1');

      expect(mockClient.del).toHaveBeenCalledWith('room-users:room-1');
      expect(mockClient.del).toHaveBeenCalledWith('room-presence:room-1');
    });

    it('pruneInactiveRoomUsers debe eliminar entradas viejas del sorted set', async () => {
      await service.pruneInactiveRoomUsers('room-1');

      expect(mockClient.zremrangebyscore).toHaveBeenCalledWith(
        'room-presence:room-1',
        '-inf',
        expect.any(Number),
      );
    });
  });

  describe('Grace Period - casos borde', () => {
    it('getGrace debe retornar null si el JSON es invalido', async () => {
      mockClient.get.mockResolvedValue('not-valid-json{{{');

      const result = await service.getGrace('device-1');

      expect(result).toBeNull();
    });
  });

  describe('Module lifecycle', () => {
    it('onModuleDestroy debe llamar a quit en el cliente Redis', async () => {
      await service.onModuleDestroy();

      expect(mockClient.quit).toHaveBeenCalled();
    });

    it('getClient debe retornar la instancia del cliente Redis', () => {
      const client = service.getClient();

      expect(client).toBeDefined();
    });

    it('retryStrategy cubre la funcion y sus ramas de Math.min', () => {
      const Redis = require('ioredis') as jest.Mock;

      // Create fresh service to get constructor call options after clearAllMocks
      const freshService = new RedisService();
      freshService.onModuleInit();

      const options = Redis.mock.calls.at(-1)?.[0];
      expect(typeof options?.retryStrategy).toBe('function');

      // times * 100 < 3000: returns times * 100
      expect(options.retryStrategy(5)).toBe(500);
      // times * 100 >= 3000: capped at 3000
      expect(options.retryStrategy(31)).toBe(3000);
    });

    it('usa valores por defecto cuando REDIS_HOST y REDIS_PORT no estan configurados', () => {
      const savedHost = process.env.REDIS_HOST;
      const savedPort = process.env.REDIS_PORT;
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;

      const Redis = require('ioredis') as jest.Mock;
      const defaultService = new RedisService();
      defaultService.onModuleInit();

      const options = Redis.mock.calls.at(-1)?.[0];
      expect(options.host).toBe('localhost');
      expect(options.port).toBe(6379);

      process.env.REDIS_HOST = savedHost;
      process.env.REDIS_PORT = savedPort;
    });
  });
});
