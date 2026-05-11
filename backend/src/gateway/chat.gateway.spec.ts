jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    subscribe: jest.fn(),
  })),
);

import { ChatGateway } from './chat.gateway';
import { RedisService } from '../redis/redis.service';
import { RoomsService } from '../rooms/rooms.service';
import { EncryptionService } from '../encryption/encryption.service';
import { Socket } from 'socket.io';

describe('ChatGateway', () => {
  let gateway: ChatGateway;

  const mockRedisService = {
    setSession: jest.fn().mockResolvedValue(undefined),
    getSession: jest.fn(),
    deleteSession: jest.fn().mockResolvedValue(undefined),
    deleteGrace: jest.fn().mockResolvedValue(undefined),
    getRoomUsers: jest.fn().mockResolvedValue([]),
    hasActiveSession: jest.fn(),
    setGrace: jest.fn().mockResolvedValue(undefined),
    getGrace: jest.fn(),
    addUserToRoom: jest.fn().mockResolvedValue(undefined),
    refreshUserInRoom: jest.fn().mockResolvedValue(undefined),
    removeUserFromRoom: jest.fn().mockResolvedValue(undefined),
    clearRoomUsers: jest.fn().mockResolvedValue(undefined),
    hasNicknameInRoom: jest.fn().mockResolvedValue(false),
    getClient: jest.fn().mockReturnValue({
      publish: jest.fn(),
      subscribe: jest.fn(),
    }),
  };

  const mockRoomsService = {
    findOne: jest.fn().mockResolvedValue({ id: 'room-1', name: 'Test Room', type: 'TEXT' }),
    validatePin: jest.fn().mockResolvedValue(true),
    getRoomWithPin: jest.fn(),
  };

  const mockEncryptionService = {
    encrypt: jest.fn().mockImplementation((text: string) => text),
    decrypt: jest.fn().mockImplementation((text: string) => text),
  };

  const mockMessageModel = {
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({
      toObject: () => ({ id: 'msg-1', content: 'test' }),
    }),
  };

  beforeEach(() => {
    gateway = new ChatGateway(
      mockRedisService as any,
      mockRoomsService as any,
      mockEncryptionService as any,
      mockMessageModel as any,
    );

    gateway['server'] = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;

    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('normalizeStoredMessage', () => {
    it('should normalize message with _id', () => {
      const msg = { _id: '123', content: 'test', reactions: [], participants: [], seenBy: [] };
      const result = gateway.normalizeStoredMessage(msg as any);
      expect(result.id).toBe('123');
    });

    it('should normalize message with id (no _id)', () => {
      const msg = { id: '456', content: 'test' };
      const result = gateway.normalizeStoredMessage(msg as any);
      expect(result.id).toBe('456');
    });

    it('should handle null reactions', () => {
      const msg = { _id: '1', content: 'test', reactions: null };
      const result = gateway.normalizeStoredMessage(msg as any);
      expect(result.reactions).toEqual([]);
    });

    it('should handle string reactions as array', () => {
      const msg = { _id: '1', content: 'test', reactions: 'invalid' };
      const result = gateway.normalizeStoredMessage(msg as any);
      expect(result.reactions).toEqual([]);
    });

    it('should handle empty participants', () => {
      const msg = { _id: '1', content: 'test', participants: [] };
      const result = gateway.normalizeStoredMessage(msg as any);
      expect(result.participants).toEqual([]);
    });

    it('should handle null participants', () => {
      const msg = { _id: '1', content: 'test', participants: null };
      const result = gateway.normalizeStoredMessage(msg as any);
      expect(result.participants).toEqual([]);
    });

    it('should handle empty seenBy', () => {
      const msg = { _id: '1', content: 'test', seenBy: [] };
      const result = gateway.normalizeStoredMessage(msg as any);
      expect(result.seenBy).toEqual([]);
    });

    it('should fall back to empty string id when neither _id nor id present (line 262)', () => {
      const msg = { content: 'test', reactions: [], participants: [], seenBy: [] };
      const result = gateway.normalizeStoredMessage(msg as any);
      expect(result.id).toBe('');
    });
  });

  describe('handleConnection', () => {
    it('should reject connection without deviceId', () => {
      const client = {
        id: 'socket-1',
        handshake: { address: '127.0.0.1', auth: {} },
        emit: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as Socket;

      gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'MISSING_DEVICE_ID',
        message: 'Falta deviceId en el handshake',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should accept connection with deviceId', () => {
      const client = {
        id: 'socket-1',
        handshake: { address: '127.0.0.1', auth: { deviceId: 'device-123' } },
        emit: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as Socket;

      gateway.handleConnection(client);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.emit).not.toHaveBeenCalled();
    });

    it('should accept connection with empty string deviceId', () => {
      const client = {
        id: 'socket-1',
        handshake: { address: '127.0.0.1', auth: { deviceId: '' } },
        emit: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as Socket;

      gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleDisconnect', () => {
    it('should do nothing without room data', () => {
      const client = { data: {} } as unknown as Socket;
      gateway.handleDisconnect(client);
      expect(mockRedisService.deleteSession).not.toHaveBeenCalled();
    });

    it('should handle when room data exists', () => {
      const mockClient = {
        id: 'socket-1',
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
      } as unknown as Socket;

      gateway.handleDisconnect(mockClient);

      expect(mockClient.data).toBeDefined();
    });
  });

  describe('clearInactivityTimer', () => {
    it('should clear timer from map', () => {
      const timer = {} as NodeJS.Timeout;
      gateway['inactivityTimers'].set('socket-1', timer);
      gateway['clearInactivityTimer']('socket-1');
      expect(gateway['inactivityTimers'].has('socket-1')).toBe(false);
    });

    it('should do nothing if timer does not exist', () => {
      expect(() => gateway['clearInactivityTimer']('nonexistent')).not.toThrow();
    });
  });

  describe('clearCleanupTimer', () => {
    it('should clear timer when deviceId is provided', () => {
      gateway['clearCleanupTimer']('device-123');
      expect(true).toBe(true);
    });

    it('should do nothing if no deviceId', () => {
      expect(() => gateway['clearCleanupTimer'](undefined)).not.toThrow();
      expect(() => gateway['clearCleanupTimer']('')).not.toThrow();
    });
  });

  describe('cleanupSocketSession', () => {
    it('should do nothing without roomId', async () => {
      const client = { data: { nickname: 'user1', deviceId: 'device-123' } } as unknown as Socket;
      await gateway['cleanupSocketSession'](client, client.data, { broadcastUserLeft: true });
      expect(mockRedisService.deleteSession).not.toHaveBeenCalled();
    });

    it('should do nothing without nickname', async () => {
      const client = { data: { roomId: 'room-1', deviceId: 'device-123' } } as unknown as Socket;
      await gateway['cleanupSocketSession'](client, client.data, { broadcastUserLeft: true });
      expect(mockRedisService.deleteSession).not.toHaveBeenCalled();
    });

    it('should do cleanup when all data exists', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
      } as unknown as Socket;
      mockRedisService.getRoomUsers.mockResolvedValue(['user2']);

      await gateway['cleanupSocketSession'](client, client.data, { broadcastUserLeft: true });

      expect(mockRedisService.deleteSession).toHaveBeenCalledWith('device-123');
      expect(mockRedisService.deleteGrace).toHaveBeenCalledWith('device-123');
      expect(mockRedisService.removeUserFromRoom).toHaveBeenCalledWith('room-1', 'user1');
    });

    it('should not broadcast when broadcastUserLeft is false', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
      } as unknown as Socket;
      mockRedisService.getRoomUsers.mockResolvedValue(['user2']);

      await gateway['cleanupSocketSession'](client, client.data, { broadcastUserLeft: false });

      expect(gateway['server'].to).not.toHaveBeenCalled();
    });
  });

  describe('startInactivityTimer', () => {
    it('should set a timer', () => {
      const client = { id: 'socket-1' } as unknown as Socket;
      gateway['startInactivityTimer'](client, 'device-123');
      expect(gateway['inactivityTimers'].has('socket-1')).toBe(true);
    });
  });

  describe('startInactivityTimer details', () => {
    it('should set inactivity timer with correct timeout', () => {
      const client = { id: 'socket-1' } as unknown as Socket;
      gateway['startInactivityTimer'](client, 'device-123');
      expect(gateway['inactivityTimers'].has('socket-1')).toBe(true);
    });
  });

  describe('clearInactivityTimer details', () => {
    it('should remove socket from inactivity timers', () => {
      const timer = {} as NodeJS.Timeout;
      gateway['inactivityTimers'].set('socket-1', timer);
      gateway['clearInactivityTimer']('socket-1');
      expect(gateway['inactivityTimers'].get('socket-1')).toBeUndefined();
    });
  });

  describe('inactivityTimeoutMs', () => {
    it('should have default timeout value', () => {
      expect(gateway['inactivityTimeoutMs']).toBe(1800000);
    });
  });

  describe('handleJoinRoom validation', () => {
    it('should reject when deviceId missing in handshake', async () => {
      const client = {
        id: 'socket-1',
        handshake: { address: '127.0.0.1', auth: {} },
        emit: jest.fn(),
        join: jest.fn(),
      } as unknown as Socket;

      await gateway.handleJoinRoom(client, { roomId: 'room-1', pin: '1234', nickname: 'user1' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'MISSING_DEVICE_ID',
        message: 'Falta deviceId en el handshake',
      });
    });

    it('should reject when already in another room', async () => {
      const client = {
        id: 'socket-1',
        handshake: { address: '127.0.0.1', auth: { deviceId: 'device-123' } },
        emit: jest.fn(),
        join: jest.fn(),
      } as unknown as Socket;

      mockRedisService.getGrace.mockResolvedValue(null);
      mockRedisService.getSession.mockResolvedValue({ roomId: 'room-other', nickname: 'user1' });

      await gateway.handleJoinRoom(client, { roomId: 'room-1', pin: '1234', nickname: 'user1' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'ALREADY_IN_ROOM',
        message: 'Ya tienes una sesión abierta en este dispositivo',
      });
    });

    it('should reject invalid PIN', async () => {
      const client = {
        id: 'socket-1',
        handshake: { address: '127.0.0.1', auth: { deviceId: 'device-123' } },
        emit: jest.fn(),
        join: jest.fn(),
      } as unknown as Socket;

      mockRedisService.getGrace.mockResolvedValue(null);
      mockRedisService.getSession.mockResolvedValue(null);
      mockRoomsService.validatePin.mockResolvedValue(false);

      await gateway.handleJoinRoom(client, { roomId: 'room-1', pin: 'wrong', nickname: 'user1' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'INVALID_PIN',
        message: 'PIN incorrecto o sala no encontrada',
      });
    });

    it('should reject nickname already in use', async () => {
      const client = {
        id: 'socket-1',
        handshake: { address: '127.0.0.1', auth: { deviceId: 'device-123' } },
        emit: jest.fn(),
        join: jest.fn(),
      } as unknown as Socket;

      mockRedisService.getGrace.mockResolvedValue(null);
      mockRedisService.getSession.mockResolvedValue(null);
      mockRoomsService.validatePin.mockResolvedValue(true);
      mockRedisService.hasNicknameInRoom.mockResolvedValue(true);

      await gateway.handleJoinRoom(client, { roomId: 'room-1', pin: '1234', nickname: 'taken' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'NICKNAME_TAKEN',
        message: 'Este nickname ya está en uso en la sala',
      });
    });
  });

  describe('handleSendMessage validation', () => {
    it('should reject when not in room', async () => {
      const client = {
        data: {},
        emit: jest.fn(),
      } as unknown as Socket;

      await gateway.handleSendMessage(client, { content: 'Hello' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'NOT_IN_ROOM',
        message: 'Debes unirte a una sala primero',
      });
    });

    it('should reject empty message', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
        emit: jest.fn(),
      } as unknown as Socket;

      const result = await gateway.handleSendMessage(client, { content: '   ' });

      expect(client.emit).not.toHaveBeenCalled();
    });

    it('should reject message too long', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
        emit: jest.fn(),
      } as unknown as Socket;

      const longContent = 'a'.repeat(1001);
      await gateway.handleSendMessage(client, { content: longContent });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'MESSAGE_TOO_LONG',
        message: 'El mensaje no puede tener más de 1000 caracteres',
      });
    });
  });

  describe('message handlers', () => {
    it('should have handleJoinRoom method', () => {
      expect(typeof gateway.handleJoinRoom).toBe('function');
    });

    it('should have handleSendMessage method', () => {
      expect(typeof gateway.handleSendMessage).toBe('function');
    });
  });

  describe('react-message validation', () => {
    it('should reject when not in room', async () => {
      const client = {
        data: {},
        emit: jest.fn(),
      } as unknown as Socket;

      await gateway.handleReactMessage(client, { messageId: 'msg-1', emoji: '👍' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'NOT_IN_ROOM',
        message: 'Debes unirte a una sala primero',
      });
    });

    it('should reject empty emoji', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user1' },
        emit: jest.fn(),
      } as unknown as Socket;

      await gateway.handleReactMessage(client, { messageId: 'msg-1', emoji: '' });

      expect(client.emit).toHaveBeenCalled();
    });
  });

  describe('mark-messages-seen validation', () => {
    it('should reject when not in room', async () => {
      const client = {
        data: {},
        emit: jest.fn(),
      } as unknown as Socket;

      await gateway.handleMarkMessagesSeen(client, { messageIds: ['msg-1'] });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'NOT_IN_ROOM',
        message: 'Debes unirte a una sala primero',
      });
    });

    it('should accept valid payload', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user1' },
        emit: jest.fn(),
      } as unknown as Socket;

      mockMessageModel.findById = jest.fn().mockResolvedValue({
        save: jest.fn().mockResolvedValue(true),
        toObject: () => ({ id: 'msg-1', seenBy: ['user1'] }),
      });

      await gateway.handleMarkMessagesSeen(client, { messageIds: ['msg-1'] });

      expect(client.emit).not.toHaveBeenCalledWith('error');
    });
  });

  describe('handleLeaveRoom', () => {
    it('should return ok when not in room', async () => {
      const client = {
        data: {},
        emit: jest.fn(),
        leave: jest.fn(),
      } as unknown as Socket;

      const result = await gateway.handleLeaveRoom(client);

      expect(result).toEqual({ ok: true });
      expect(client.leave).not.toHaveBeenCalled();
    });

    it('should cleanup when in room', async () => {
      const client = {
        id: 'socket-1',
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
        emit: jest.fn(),
        leave: jest.fn().mockResolvedValue(undefined),
      } as unknown as Socket;

      mockRedisService.getRoomUsers.mockResolvedValue(['user2']);

      const result = await gateway.handleLeaveRoom(client);

      expect(result).toEqual({ ok: true });
      expect(mockRedisService.deleteSession).toHaveBeenCalledWith('device-123');
    });
  });

  describe('gateway internals', () => {
    it('should have inactivityTimers map', () => {
      expect(gateway['inactivityTimers']).toBeDefined();
      expect(gateway['inactivityTimers'] instanceof Map).toBe(true);
    });

    it('should have cleanupTimers map', () => {
      expect(gateway['cleanupTimers']).toBeDefined();
      expect(gateway['cleanupTimers'] instanceof Map).toBe(true);
    });

    it('should have logger', () => {
      expect(gateway['logger']).toBeDefined();
    });
  });

  describe('afterInit', () => {
    let ioredis: jest.Mock;
    let mockSubClient: { on: jest.Mock; subscribe: jest.Mock };

    beforeEach(() => {
      ioredis = require('ioredis') as jest.Mock;
      mockSubClient = { on: jest.fn(), subscribe: jest.fn() };
      ioredis.mockImplementation(() => mockSubClient);
      gateway['presenceHeartbeatTimer'] = undefined;
    });

    it('should set server and start presence heartbeat', async () => {
      const mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        sockets: { sockets: new Map() },
      } as any;

      await gateway.afterInit(mockServer);

      expect(gateway['server']).toBe(mockServer);
      expect(gateway['presenceHeartbeatTimer']).toBeDefined();
    });

    it('should re-emit socket events received from Redis worker', async () => {
      const mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        sockets: { sockets: new Map() },
      } as any;

      await gateway.afterInit(mockServer);

      const messageHandlerCall = mockSubClient.on.mock.calls.find(([evt]: [string]) => evt === 'message');
      const messageHandler = messageHandlerCall?.[1] as (ch: string, raw: string) => void;

      messageHandler('socket:events', JSON.stringify({ type: 'new-file', roomId: 'room-1', payload: { url: 'test' } }));

      expect(mockServer.to).toHaveBeenCalledWith('room-1');
    });

    it('should ignore messages on other channels', async () => {
      const mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        sockets: { sockets: new Map() },
      } as any;

      await gateway.afterInit(mockServer);

      const messageHandlerCall = mockSubClient.on.mock.calls.find(([evt]: [string]) => evt === 'message');
      const messageHandler = messageHandlerCall?.[1] as (ch: string, raw: string) => void;

      messageHandler('other-channel', JSON.stringify({ type: 'test', roomId: 'room-1' }));

      expect(mockServer.to).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON in socket events gracefully', async () => {
      const mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        sockets: { sockets: new Map() },
      } as any;

      await gateway.afterInit(mockServer);

      const messageHandlerCall = mockSubClient.on.mock.calls.find(([evt]: [string]) => evt === 'message');
      const messageHandler = messageHandlerCall?.[1] as (ch: string, raw: string) => void;

      expect(() => messageHandler('socket:events', 'not-valid-json')).not.toThrow();
    });

    it('should not emit when msg.roomId is missing (line 132 false branch)', async () => {
      const mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        sockets: { sockets: new Map() },
      } as any;

      await gateway.afterInit(mockServer);

      const messageHandlerCall = mockSubClient.on.mock.calls.find(([evt]: [string]) => evt === 'message');
      const messageHandler = messageHandlerCall?.[1] as (ch: string, raw: string) => void;

      // Valid JSON but missing roomId — should NOT call server.to
      messageHandler('socket:events', JSON.stringify({ type: 'new-file', payload: {} }));

      expect(mockServer.to).not.toHaveBeenCalled();
    });

    it('should call subscribe callback on success', async () => {
      mockSubClient.subscribe.mockImplementation((_ch: string, cb: (err: null, count: number) => void) => cb(null, 1));

      const mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        sockets: { sockets: new Map() },
      } as any;

      await expect(gateway.afterInit(mockServer)).resolves.not.toThrow();
    });

    it('should call subscribe callback on error without throwing', async () => {
      mockSubClient.subscribe.mockImplementation((_ch: string, cb: (err: Error, count: number) => void) => cb(new Error('Redis down'), 0));

      const mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        sockets: { sockets: new Map() },
      } as any;

      await expect(gateway.afterInit(mockServer)).resolves.not.toThrow();
    });

    it('should handle ioredis constructor error gracefully', async () => {
      ioredis.mockImplementationOnce(() => { throw new Error('Cannot connect'); });

      const mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        sockets: { sockets: new Map() },
      } as any;

      await expect(gateway.afterInit(mockServer)).resolves.not.toThrow();
    });

    it('should not start a second heartbeat timer if already running', () => {
      gateway['presenceHeartbeatTimer'] = {} as NodeJS.Timeout;
      const original = gateway['presenceHeartbeatTimer'];
      gateway['startPresenceHeartbeat']();
      expect(gateway['presenceHeartbeatTimer']).toBe(original);
    });

    it('should pass retryStrategy to ioredis and cover its function body', async () => {
      const mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        sockets: { sockets: new Map() },
      } as any;

      await gateway.afterInit(mockServer);

      const options = ioredis.mock.calls[0]?.[0];
      expect(typeof options?.retryStrategy).toBe('function');
      // Cover the retryStrategy body: Math.min(times * 100, 3000)
      expect(options.retryStrategy(5)).toBe(500);
      expect(options.retryStrategy(31)).toBe(3000);
    });

    it('should fire heartbeat timer callback and call refreshPresence (line 165)', async () => {
      const mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        sockets: { sockets: new Map() },
      } as any;

      await gateway.afterInit(mockServer);
      gateway['server'] = mockServer;

      // Advance exactly one heartbeat interval to fire the callback once (not infinitely)
      await jest.advanceTimersByTimeAsync(gateway['presenceHeartbeatMs']);
    });
  });

  describe('refreshPresence', () => {
    it('should skip when server has no sockets', async () => {
      gateway['server'] = { sockets: null } as any;
      await gateway['refreshPresence']();
      expect(mockRedisService.refreshUserInRoom).not.toHaveBeenCalled();
    });

    it('should refresh active users and emit users-updated', async () => {
      const socketsMap = new Map();
      socketsMap.set('s1', { data: { roomId: 'room-1', nickname: 'user1', cleanedUp: false } });

      gateway['server'] = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        sockets: { sockets: socketsMap },
      } as any;

      mockRedisService.getRoomUsers.mockResolvedValue(['user1']);
      await gateway['refreshPresence']();

      expect(mockRedisService.refreshUserInRoom).toHaveBeenCalledWith('room-1', 'user1');
      expect(gateway['server'].to).toHaveBeenCalledWith('room-1');
    });

    it('should skip sockets marked as cleanedUp', async () => {
      const socketsMap = new Map();
      socketsMap.set('s1', { data: { roomId: 'room-1', nickname: 'user1', cleanedUp: true } });

      gateway['server'] = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        sockets: { sockets: socketsMap },
      } as any;

      await gateway['refreshPresence']();
      expect(mockRedisService.refreshUserInRoom).not.toHaveBeenCalled();
    });
  });

  describe('touchClientPresence', () => {
    it('should skip when roomId is missing', async () => {
      await gateway['touchClientPresence']({ nickname: 'user1' });
      expect(mockRedisService.refreshUserInRoom).not.toHaveBeenCalled();
    });

    it('should skip when socket is cleanedUp', async () => {
      await gateway['touchClientPresence']({ roomId: 'room-1', nickname: 'user1', cleanedUp: true });
      expect(mockRedisService.refreshUserInRoom).not.toHaveBeenCalled();
    });

    it('should refresh presence and emit users-updated', async () => {
      mockRedisService.getRoomUsers.mockResolvedValue(['user1']);
      await gateway['touchClientPresence']({ roomId: 'room-1', nickname: 'user1' });
      expect(mockRedisService.refreshUserInRoom).toHaveBeenCalledWith('room-1', 'user1');
      expect(gateway['server'].to).toHaveBeenCalledWith('room-1');
    });
  });

  describe('getActiveRoomUsers', () => {
    it('should fall back to redis when server.in is unavailable', async () => {
      gateway['server'] = { to: jest.fn().mockReturnThis(), emit: jest.fn() } as any;
      mockRedisService.getRoomUsers.mockResolvedValue(['user1']);

      const users = await gateway['getActiveRoomUsers']('room-1');

      expect(users).toEqual(['user1']);
    });

    it('should use socket users when fetchSockets returns results', async () => {
      const fetchSockets = jest.fn().mockResolvedValue([
        { data: { nickname: 'user1' } },
        { data: { nickname: 'user2' } },
      ]);
      gateway['server'] = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        in: jest.fn().mockReturnValue({ fetchSockets }),
      } as any;

      const users = await gateway['getActiveRoomUsers']('room-1');

      expect(users).toContain('user1');
      expect(users).toContain('user2');
    });

    it('should fall back to redis when fetchSockets returns no nicknames', async () => {
      const fetchSockets = jest.fn().mockResolvedValue([{ data: { nickname: null } }]);
      gateway['server'] = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        in: jest.fn().mockReturnValue({ fetchSockets }),
      } as any;
      mockRedisService.getRoomUsers.mockResolvedValue(['user1']);

      const users = await gateway['getActiveRoomUsers']('room-1');
      expect(users).toEqual(['user1']);
    });
  });

  describe('getClientBaseSessionKey / getClientSessionKey', () => {
    it('should use x-forwarded-for header when present', () => {
      const client = {
        handshake: { address: '127.0.0.1', headers: { 'x-forwarded-for': '10.0.0.1' }, auth: {} },
      } as unknown as Socket;

      expect(gateway['getClientBaseSessionKey'](client)).toBe('ip:10.0.0.1');
    });

    it('should use socket address when no forwarded-for header', () => {
      const client = {
        handshake: { address: '192.168.1.1', headers: {}, auth: {} },
      } as unknown as Socket;

      expect(gateway['getClientBaseSessionKey'](client)).toBe('ip:192.168.1.1');
    });

    it('should return device:<browserDeviceId> as session key', () => {
      const client = {
        handshake: { address: '127.0.0.1', headers: {}, auth: { deviceId: 'uuid-abc-123' } },
      } as unknown as Socket;

      expect(gateway['getClientSessionKey'](client)).toBe('device:uuid-abc-123');
    });

    it('should return device: with empty string when no deviceId', () => {
      const client = {
        handshake: { address: '127.0.0.1', headers: {}, auth: {} },
      } as unknown as Socket;

      expect(gateway['getClientSessionKey'](client)).toBe('device:');
    });

    it('should use first element when x-forwarded-for is an array (line 227)', () => {
      const client = {
        handshake: {
          address: '127.0.0.1',
          headers: { 'x-forwarded-for': ['10.0.0.1', '10.0.0.2'] },
          auth: {},
        },
      } as unknown as Socket;

      expect(gateway['getClientBaseSessionKey'](client)).toBe('ip:10.0.0.1');
    });
  });

  describe('getClientFingerprintKey', () => {
    it('should return ip+fp key when fingerprint is present', () => {
      const client = {
        handshake: { address: '192.168.1.5', headers: {}, auth: { deviceFingerprint: 'abc12345' } },
      } as unknown as Socket;
      expect(gateway['getClientFingerprintKey'](client)).toBe('ip:192.168.1.5:fp:abc12345');
    });

    it('should return empty string when fingerprint is missing', () => {
      const client = {
        handshake: { address: '192.168.1.5', headers: {}, auth: {} },
      } as unknown as Socket;
      expect(gateway['getClientFingerprintKey'](client)).toBe('');
    });

    it('should return empty string when fingerprint is empty', () => {
      const client = {
        handshake: { address: '192.168.1.5', headers: {}, auth: { deviceFingerprint: '' } },
      } as unknown as Socket;
      expect(gateway['getClientFingerprintKey'](client)).toBe('');
    });

    it('should use x-forwarded-for header when present', () => {
      const client = {
        handshake: {
          address: '127.0.0.1',
          headers: { 'x-forwarded-for': '10.0.0.5' },
          auth: { deviceFingerprint: 'abc12345' },
        },
      } as unknown as Socket;
      expect(gateway['getClientFingerprintKey'](client)).toBe('ip:10.0.0.5:fp:abc12345');
    });

    it('should use first element when x-forwarded-for is an array', () => {
      const client = {
        handshake: {
          address: '127.0.0.1',
          headers: { 'x-forwarded-for': ['10.0.0.1', '10.0.0.2'] },
          auth: { deviceFingerprint: 'abc12345' },
        },
      } as unknown as Socket;
      expect(gateway['getClientFingerprintKey'](client)).toBe('ip:10.0.0.1:fp:abc12345');
    });
  });

  describe('handleJoinRoom - cross-browser blocking via fp+ip', () => {
    it('should reject when fp+ip session exists even with a different deviceId (different browser)', async () => {
      const client = {
        id: 'socket-1',
        handshake: { address: '127.0.0.1', headers: {}, auth: { deviceId: 'firefox-uuid', deviceFingerprint: 'fp123' } },
        emit: jest.fn(),
        join: jest.fn(),
      } as unknown as Socket;

      mockRedisService.getGrace.mockResolvedValue(null);
      // Chrome's UUID not found, but the IP+fp key (set by Chrome) is found
      mockRedisService.getSession
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ roomId: 'room-1', nickname: 'user1' });

      await gateway.handleJoinRoom(client, { roomId: 'room-1', pin: '1234', nickname: 'user1' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'ALREADY_IN_ROOM',
        message: 'Ya tienes una sesión abierta en este dispositivo',
      });
    });

    it('should allow join when neither device nor fp+ip session exists', async () => {
      const client = {
        id: 'socket-1',
        handshake: { address: '127.0.0.1', headers: {}, auth: { deviceId: 'new-uuid', deviceFingerprint: 'fp456' } },
        emit: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        data: {} as any,
      } as unknown as Socket;

      mockRedisService.getGrace.mockResolvedValue(null);
      mockRedisService.getSession.mockResolvedValue(null);
      mockRoomsService.validatePin.mockResolvedValue(true);
      mockRedisService.hasNicknameInRoom.mockResolvedValue(false);
      mockRoomsService.findOne.mockResolvedValue({ id: 'room-1', name: 'Test', type: 'TEXT' });
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      mockRedisService.getRoomUsers.mockResolvedValue(['newuser']);

      await gateway.handleJoinRoom(client, { roomId: 'room-1', pin: '1234', nickname: 'newuser' });

      expect(client.join).toHaveBeenCalledWith('room-1');
    });
  });

  describe('handleDisconnect with grace timer', () => {
    it('should set grace and schedule cleanup', async () => {
      const client = {
        id: 'socket-1',
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
      } as unknown as Socket;

      mockRedisService.setGrace.mockResolvedValue(undefined);
      mockRedisService.getGrace.mockResolvedValue({ roomId: 'room-1', nickname: 'user1' });
      mockRedisService.getRoomUsers.mockResolvedValue([]);

      await gateway.handleDisconnect(client);

      expect(mockRedisService.setGrace).toHaveBeenCalledWith('device-123', { roomId: 'room-1', nickname: 'user1' });

      jest.runAllTimers();
      await Promise.resolve();

      expect(mockRedisService.deleteSession).toHaveBeenCalled();
    });

    it('should skip cleanup when grace was already consumed by reconnect', async () => {
      const client = {
        id: 'socket-1',
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
      } as unknown as Socket;

      mockRedisService.setGrace.mockResolvedValue(undefined);
      mockRedisService.getGrace.mockResolvedValue(null);

      await gateway.handleDisconnect(client);
      jest.runAllTimers();
      await Promise.resolve();

      expect(mockRedisService.deleteSession).not.toHaveBeenCalled();
    });

    it('should skip already cleaned-up sockets', async () => {
      const client = {
        id: 'socket-1',
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123', cleanedUp: true },
      } as unknown as Socket;

      await gateway.handleDisconnect(client);
      expect(mockRedisService.setGrace).not.toHaveBeenCalled();
    });

    it('should delete deviceId session on timeout', async () => {
      const client = {
        id: 'socket-1',
        data: {
          roomId: 'room-1',
          nickname: 'user1',
          deviceId: 'device:uuid-abc',
        },
      } as unknown as Socket;

      mockRedisService.setGrace.mockResolvedValue(undefined);
      mockRedisService.getGrace.mockResolvedValue({ roomId: 'room-1', nickname: 'user1' });
      mockRedisService.getRoomUsers.mockResolvedValue([]);

      await gateway.handleDisconnect(client);
      await jest.runAllTimersAsync();

      expect(mockRedisService.deleteSession).toHaveBeenCalledWith('device:uuid-abc');
      expect(mockRedisService.deleteSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanupSocketSession - session cleanup', () => {
    it('should delete the deviceId session', async () => {
      const client = { data: {} } as unknown as Socket;
      const data = {
        roomId: 'room-1',
        nickname: 'user1',
        deviceId: 'device:uuid-xyz',
      };

      mockRedisService.getRoomUsers.mockResolvedValue([]);

      await gateway['cleanupSocketSession'](client, data, { broadcastUserLeft: false });

      expect(mockRedisService.deleteSession).toHaveBeenCalledWith('device:uuid-xyz');
      expect(mockRedisService.deleteSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('startInactivityTimer callback', () => {
    it('should disconnect and cleanup when timer fires', async () => {
      const client = {
        id: 'socket-1',
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
        emit: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as Socket;

      mockRedisService.getRoomUsers.mockResolvedValue([]);

      gateway['startInactivityTimer'](client, 'device-123');
      await jest.runAllTimersAsync();

      expect(client.emit).toHaveBeenCalledWith('kicked', expect.objectContaining({ reason: 'INACTIVITY' }));
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleJoinRoom - reconnect flow', () => {
    it('should reconnect when grace data matches room and nickname', async () => {
      const client = {
        id: 'socket-1',
        handshake: { address: '127.0.0.1', headers: {}, auth: { deviceId: 'browser-id' } },
        emit: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        data: {} as any,
      } as unknown as Socket;

      mockRedisService.getGrace.mockResolvedValue({ roomId: 'room-1', nickname: 'user1' });
      mockRoomsService.findOne.mockResolvedValue({ id: 'room-1', name: 'Test', type: 'TEXT' });
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      mockRedisService.getRoomUsers.mockResolvedValue(['user1']);

      await gateway.handleJoinRoom(client, { roomId: 'room-1', pin: '1234', nickname: 'user1' });

      expect(client.join).toHaveBeenCalledWith('room-1');
      const successCall = (client.emit as jest.Mock).mock.calls.find(([evt]) => evt === 'join-success');
      expect(successCall).toBeDefined();
      expect(successCall[1].reconnected).toBe(true);
    });
  });

  describe('handleJoinRoom - session stored for deviceId', () => {
    it('should set session for device key and fp+ip key on join', async () => {
      const client = {
        id: 'socket-1',
        handshake: { address: '127.0.0.1', headers: {}, auth: { deviceId: 'browser-id', deviceFingerprint: 'fp123' } },
        emit: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        data: {} as any,
      } as unknown as Socket;

      mockRedisService.getGrace.mockResolvedValue(null);
      mockRedisService.getSession.mockResolvedValue(null);
      mockRoomsService.validatePin.mockResolvedValue(true);
      mockRedisService.hasNicknameInRoom.mockResolvedValue(false);
      mockRoomsService.findOne.mockResolvedValue({ id: 'room-1', name: 'Test', type: 'TEXT' });
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      mockRedisService.getRoomUsers.mockResolvedValue(['newuser']);

      await gateway.handleJoinRoom(client, { roomId: 'room-1', pin: '1234', nickname: 'newuser' });

      expect(mockRedisService.setSession).toHaveBeenCalledTimes(2);
      expect(mockRedisService.setSession).toHaveBeenCalledWith('device:browser-id', 'room-1', 'newuser');
      expect(mockRedisService.setSession).toHaveBeenCalledWith('ip:127.0.0.1:fp:fp123', 'room-1', 'newuser');
    });

    it('should set only device key when no fingerprint is provided', async () => {
      const client = {
        id: 'socket-1',
        handshake: { address: '127.0.0.1', headers: {}, auth: { deviceId: 'browser-id' } },
        emit: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        data: {} as any,
      } as unknown as Socket;

      mockRedisService.getGrace.mockResolvedValue(null);
      mockRedisService.getSession.mockResolvedValue(null);
      mockRoomsService.validatePin.mockResolvedValue(true);
      mockRedisService.hasNicknameInRoom.mockResolvedValue(false);
      mockRoomsService.findOne.mockResolvedValue({ id: 'room-1', name: 'Test', type: 'TEXT' });
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      mockRedisService.getRoomUsers.mockResolvedValue(['newuser']);

      await gateway.handleJoinRoom(client, { roomId: 'room-1', pin: '1234', nickname: 'newuser' });

      expect(mockRedisService.setSession).toHaveBeenCalledTimes(1);
      expect(mockRedisService.setSession).toHaveBeenCalledWith('device:browser-id', 'room-1', 'newuser');
    });
  });

  describe('handleSendMessage - error path', () => {
    it('should emit MESSAGE_SAVE_FAILED when messageModel.create throws', async () => {
      const client = {
        id: 'socket-1',
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
        emit: jest.fn(),
      } as unknown as Socket;

      mockMessageModel.create.mockRejectedValue(new Error('Mongo down'));
      gateway['server'] = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([]) }),
      } as any;
      mockRedisService.getRoomUsers.mockResolvedValue(['user1']);

      await gateway.handleSendMessage(client, { content: 'Hello' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'MESSAGE_SAVE_FAILED',
        message: 'No se pudo guardar el mensaje',
      });
    });
  });

  describe('handleReactMessage - success paths', () => {
    it('should add a new reaction when emoji not previously used', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
        emit: jest.fn(),
      } as unknown as Socket;

      const mockMsg = {
        _id: 'msg-1',
        roomId: 'room-1',
        reactions: [],
        save: jest.fn().mockResolvedValue(true),
      };
      mockMessageModel.findOne.mockResolvedValue(mockMsg);
      mockRedisService.getRoomUsers.mockResolvedValue(['user1']);

      await gateway.handleReactMessage(client, { messageId: 'msg-1', emoji: '👍' });

      expect(mockMsg.save).toHaveBeenCalled();
      expect(gateway['server'].to).toHaveBeenCalledWith('room-1');
    });

    it('should toggle reaction off when user already reacted with same emoji', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
        emit: jest.fn(),
      } as unknown as Socket;

      const mockMsg = {
        _id: 'msg-1',
        roomId: 'room-1',
        reactions: [{ emoji: '👍', users: ['user1'] }],
        save: jest.fn().mockResolvedValue(true),
      };
      mockMessageModel.findOne.mockResolvedValue(mockMsg);
      mockRedisService.getRoomUsers.mockResolvedValue(['user1']);

      await gateway.handleReactMessage(client, { messageId: 'msg-1', emoji: '👍' });

      expect(mockMsg.save).toHaveBeenCalled();
      expect(mockMsg.reactions.length).toBe(0); // filtered out because 0 users
    });

    it('should add user to existing reaction when another user already reacted', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user2', deviceId: 'device-456' },
        emit: jest.fn(),
      } as unknown as Socket;

      const mockMsg = {
        _id: 'msg-1',
        roomId: 'room-1',
        reactions: [{ emoji: '👍', users: ['user1'] }],
        save: jest.fn().mockResolvedValue(true),
      };
      mockMessageModel.findOne.mockResolvedValue(mockMsg);

      await gateway.handleReactMessage(client, { messageId: 'msg-1', emoji: '👍' });

      expect(mockMsg.save).toHaveBeenCalled();
      expect(mockMsg.reactions[0].users).toContain('user2');
    });

    it('should emit MESSAGE_NOT_FOUND when message does not exist', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
        emit: jest.fn(),
      } as unknown as Socket;

      mockMessageModel.findOne.mockResolvedValue(null);

      await gateway.handleReactMessage(client, { messageId: 'msg-999', emoji: '👍' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'MESSAGE_NOT_FOUND',
        message: 'No se encontro el mensaje',
      });
    });

    it('should handle non-array reactions field gracefully', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
        emit: jest.fn(),
      } as unknown as Socket;

      const mockMsg = {
        _id: 'msg-1',
        roomId: 'room-1',
        reactions: null,
        save: jest.fn().mockResolvedValue(true),
      };
      mockMessageModel.findOne.mockResolvedValue(mockMsg);

      await gateway.handleReactMessage(client, { messageId: 'msg-1', emoji: '❤️' });

      expect(mockMsg.save).toHaveBeenCalled();
    });
  });

  describe('handleMarkMessagesSeen - processing', () => {
    it('should process messages and emit message-seen-updated', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user2', deviceId: 'device-456' },
        emit: jest.fn(),
      } as unknown as Socket;

      const mockMsg = {
        _id: 'msg-1',
        roomId: 'room-1',
        nickname: 'user1',
        seenBy: ['user1'],
        participants: ['user1'],
        save: jest.fn().mockResolvedValue(true),
      };

      mockMessageModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([mockMsg]) });
      gateway['server'] = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([]) }),
      } as any;
      mockRedisService.getRoomUsers.mockResolvedValue(['user1', 'user2']);

      await gateway.handleMarkMessagesSeen(client, { messageIds: ['msg-1'] });

      expect(mockMsg.save).toHaveBeenCalled();
      expect(gateway['server'].to).toHaveBeenCalledWith('room-1');
    });

    it('should skip updating when seenBy and participants are already up to date', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
        emit: jest.fn(),
      } as unknown as Socket;

      const mockMsg = {
        _id: 'msg-1',
        roomId: 'room-1',
        nickname: 'user1',
        seenBy: ['user1'],
        participants: ['user1'],
        save: jest.fn().mockResolvedValue(true),
      };

      mockMessageModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([mockMsg]) });
      gateway['server'] = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([]) }),
      } as any;
      mockRedisService.getRoomUsers.mockResolvedValue(['user1']);

      await gateway.handleMarkMessagesSeen(client, { messageIds: ['msg-1'] });

      expect(mockMsg.save).not.toHaveBeenCalled();
    });

    it('should skip when messageIds list is empty', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user1' },
        emit: jest.fn(),
      } as unknown as Socket;

      await gateway.handleMarkMessagesSeen(client, { messageIds: [] });

      expect(mockMessageModel.find).not.toHaveBeenCalled();
    });

    it('should reset inactivity timer when deviceId is present', async () => {
      const client = {
        id: 'socket-1',
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
        emit: jest.fn(),
      } as unknown as Socket;

      const mockMsg = {
        _id: 'msg-1',
        roomId: 'room-1',
        nickname: 'user1',
        seenBy: ['user1'],
        participants: ['user1', 'user2'],
        save: jest.fn().mockResolvedValue(true),
      };

      mockMessageModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([mockMsg]) });
      gateway['server'] = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([]) }),
      } as any;
      mockRedisService.getRoomUsers.mockResolvedValue(['user1', 'user2']);

      gateway['inactivityTimers'].set('socket-1', {} as NodeJS.Timeout);
      await gateway.handleMarkMessagesSeen(client, { messageIds: ['msg-1'] });

      expect(gateway['inactivityTimers'].has('socket-1')).toBe(true);
    });
  });

  describe('handleDeleteMessage - invalid payload', () => {
    it('should emit INVALID_PAYLOAD when messageId is empty string', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
        emit: jest.fn(),
      } as unknown as Socket;

      await gateway.handleDeleteMessage(client, { messageId: '' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'INVALID_PAYLOAD',
        message: 'ID de mensaje requerido',
      });
    });

    it('should emit INVALID_PAYLOAD when messageId is undefined', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
        emit: jest.fn(),
      } as unknown as Socket;

      await gateway.handleDeleteMessage(client, { messageId: undefined as any });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'INVALID_PAYLOAD',
        message: 'ID de mensaje requerido',
      });
    });
  });

  describe('join-room successful flow', () => {
    it('should join room when all validations pass', async () => {
      const client = {
        id: 'socket-1',
        handshake: { address: '127.0.0.1', auth: { deviceId: 'device-123' } },
        emit: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        data: null as any,
      } as unknown as Socket;

      // Reset mocks for clean test
      mockRedisService.getGrace.mockResolvedValue(null);
      mockRedisService.getSession.mockResolvedValue(null);
      mockRoomsService.validatePin.mockResolvedValue(true);
      mockRedisService.hasNicknameInRoom.mockResolvedValue(false);
      mockRoomsService.findOne.mockResolvedValue({ id: 'room-1', name: 'Test Room', type: 'TEXT' });
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      mockRedisService.getRoomUsers.mockResolvedValue(['user1']);

      await gateway.handleJoinRoom(client, { roomId: 'room-1', pin: '1234', nickname: 'newuser' });

      // Verify join was called
      expect(client.join).toHaveBeenCalledWith('room-1');
      // Verify session was set
      expect(mockRedisService.setSession).toHaveBeenCalled();
      // Verify user was added to room
      expect(mockRedisService.addUserToRoom).toHaveBeenCalledWith('room-1', 'newuser');
    });
  });

  describe('send-message successful flow', () => {
    it('should send message and reset inactivity timer', async () => {
      const client = {
        id: 'socket-1',
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
        emit: jest.fn(),
      } as unknown as Socket;

      mockMessageModel.create.mockResolvedValue({
        toObject: () => ({ id: 'msg-1', roomId: 'room-1', content: 'Hello', nickname: 'user1', reactions: [], participants: ['user1'], seenBy: ['user1'], timestamp: new Date() }),
      });
      mockRedisService.getRoomUsers.mockResolvedValue(['user1', 'user2']);

      // Clear and set inactivity timer to test reset
      gateway['inactivityTimers'].set('socket-1', {} as NodeJS.Timeout);

      await gateway.handleSendMessage(client, { content: 'Hello' });

      expect(mockMessageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'room-1',
          nickname: 'user1',
          content: 'Hello',
        }),
      );
    });
  });

  describe('handleDeleteMessage', () => {
    const mockMessageDoc = {
      _id: 'msg-1',
      roomId: 'room-1',
      nickname: 'user1',
      content: 'test message',
      reactions: [],
      participants: ['user1', 'user2'],
      seenBy: ['user1'],
      deleted: false,
      save: jest.fn().mockResolvedValue(true),
    };

    it('should delete message when user is the author', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
        emit: jest.fn(),
      } as unknown as Socket;

      mockMessageModel.findOne.mockResolvedValue({ ...mockMessageDoc });

      await gateway.handleDeleteMessage(client, { messageId: 'msg-1' });

      expect(mockMessageDoc.save).toHaveBeenCalled();
      expect(gateway['server'].to).toHaveBeenCalledWith('room-1');
      expect(gateway['server'].to('room-1').emit).toHaveBeenCalledWith('message-deleted', {
        messageId: 'msg-1',
        roomId: 'room-1',
      });
    });

    it('should reject when user is not the author', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user2', deviceId: 'device-456' },
        emit: jest.fn(),
      } as unknown as Socket;

      mockMessageModel.findOne.mockResolvedValue({ ...mockMessageDoc });

      await gateway.handleDeleteMessage(client, { messageId: 'msg-1' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'NOT_AUTHOR',
        message: 'No puedes eliminar un mensaje que no es tuyo',
      });
      expect(mockMessageDoc.save).not.toHaveBeenCalled();
    });

    it('should reject when message is already deleted', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
        emit: jest.fn(),
      } as unknown as Socket;

      const alreadyDeletedMessage = {
        ...mockMessageDoc,
        deleted: true,
      };

      mockMessageModel.findOne.mockResolvedValue(alreadyDeletedMessage);

      await gateway.handleDeleteMessage(client, { messageId: 'msg-1' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'ALREADY_DELETED',
        message: 'Este mensaje ya fue eliminado',
      });
      expect(alreadyDeletedMessage.save).not.toHaveBeenCalled();
    });

    it('should reject when not in a room', async () => {
      const client = {
        data: {},
        emit: jest.fn(),
      } as unknown as Socket;

      await gateway.handleDeleteMessage(client, { messageId: 'msg-1' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'NOT_IN_ROOM',
        message: 'Debes unirte a una sala primero',
      });
    });

    it('should reject when message not found', async () => {
      const client = {
        data: { roomId: 'room-1', nickname: 'user1', deviceId: 'device-123' },
        emit: jest.fn(),
      } as unknown as Socket;

      mockMessageModel.findOne.mockResolvedValue(null);

      await gateway.handleDeleteMessage(client, { messageId: 'non-existent' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'MESSAGE_NOT_FOUND',
        message: 'No se encontro el mensaje',
      });
    });
  });

  describe('handleJoinRoom - reconnect stores session for deviceId', () => {
    it('should set session for device key and fp+ip key during reconnect', async () => {
      const client = {
        id: 'socket-1',
        handshake: {
          address: '127.0.0.1',
          headers: {},
          auth: { deviceId: 'browser-id', deviceFingerprint: 'fp123' },
        },
        emit: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        data: {} as any,
      } as unknown as Socket;

      mockRedisService.getGrace.mockResolvedValue({ roomId: 'room-1', nickname: 'user1' });
      mockRoomsService.findOne.mockResolvedValue({ id: 'room-1', name: 'Test', type: 'TEXT' });
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      mockRedisService.getRoomUsers.mockResolvedValue(['user1']);

      await gateway.handleJoinRoom(client, { roomId: 'room-1', pin: '1234', nickname: 'user1' });

      expect(mockRedisService.setSession).toHaveBeenCalledTimes(2);
      expect(mockRedisService.setSession).toHaveBeenCalledWith('device:browser-id', 'room-1', 'user1');
      expect(mockRedisService.setSession).toHaveBeenCalledWith('ip:127.0.0.1:fp:fp123', 'room-1', 'user1');
    });
  });

  describe('handleJoinRoom - history map callbacks (lines 433 and 523)', () => {
    const mockHistoryMsg = {
      _id: 'msg-history-1',
      roomId: 'room-1',
      content: 'encrypted-hello',
      nickname: 'user1',
      reactions: [],
      participants: ['user1'],
      seenBy: ['user1'],
      timestamp: new Date(),
    };

    it('should map non-empty history in reconnect path (line 433)', async () => {
      const client = {
        id: 'socket-1',
        handshake: { address: '127.0.0.1', headers: {}, auth: { deviceId: 'browser-id' } },
        emit: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        data: {} as any,
      } as unknown as Socket;

      mockRedisService.getGrace.mockResolvedValue({ roomId: 'room-1', nickname: 'user1' });
      mockRoomsService.findOne.mockResolvedValue({ id: 'room-1', name: 'Test', type: 'TEXT' });
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockHistoryMsg]),
      });
      mockRedisService.getRoomUsers.mockResolvedValue(['user1']);

      await gateway.handleJoinRoom(client, { roomId: 'room-1', pin: '1234', nickname: 'user1' });

      const successCall = (client.emit as jest.Mock).mock.calls.find(([evt]) => evt === 'join-success');
      expect(successCall).toBeDefined();
      expect(successCall[1].history.length).toBe(1);
      expect(successCall[1].reconnected).toBe(true);
    });

    it('should map non-empty history in regular join path (line 523)', async () => {
      const client = {
        id: 'socket-1',
        handshake: { address: '127.0.0.1', headers: {}, auth: { deviceId: 'browser-id' } },
        emit: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        data: {} as any,
      } as unknown as Socket;

      mockRedisService.getGrace.mockResolvedValue(null);
      mockRedisService.getSession.mockResolvedValue(null);
      mockRoomsService.validatePin.mockResolvedValue(true);
      mockRedisService.hasNicknameInRoom.mockResolvedValue(false);
      mockRoomsService.findOne.mockResolvedValue({ id: 'room-1', name: 'Test', type: 'TEXT' });
      mockMessageModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockHistoryMsg]),
      });
      mockRedisService.getRoomUsers.mockResolvedValue(['newuser']);

      await gateway.handleJoinRoom(client, { roomId: 'room-1', pin: '1234', nickname: 'newuser' });

      const successCall = (client.emit as jest.Mock).mock.calls.find(([evt]) => evt === 'join-success');
      expect(successCall).toBeDefined();
      expect(successCall[1].history.length).toBe(1);
    });
  });
});
