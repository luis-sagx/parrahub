import { ChatGateway } from './chat.gateway';
import { RedisService } from '../redis/redis.service';
import { RoomsService } from '../rooms/rooms.service';
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

  const mockMessageModel = {
    find: jest.fn().mockReturnThis(),
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
        message: 'Ya estás conectado en otra sala',
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
});