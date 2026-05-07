import { Test, TestingModule } from '@nestjs/testing';
import { WsSessionGuard } from './ws-session.guard';
import { RedisService } from '../../redis/redis.service';
import { ExecutionContext } from '@nestjs/common';

describe('WsSessionGuard', () => {
  let guard: WsSessionGuard;

  const mockRedisService = {
    getSession: jest.fn(),
  };

  const createMockClient = (deviceId: string) => ({
    handshake: { auth: { deviceId } },
    emit: jest.fn(),
  });

  const createMockContext = (deviceId: string, roomId: string): ExecutionContext => {
    const client = createMockClient(deviceId);
    return {
      switchToWs: () => ({
        getClient: () => client,
        getData: () => ({ roomId }),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WsSessionGuard,
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    guard = module.get<WsSessionGuard>(WsSessionGuard);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should reject when deviceId is missing', async () => {
    const context = createMockContext('', 'room-1');
    const result = await guard.canActivate(context);
    expect(result).toBe(false);
  });

  it('should reject when deviceId is empty string', async () => {
    const context = createMockContext('', 'room-1');
    const result = await guard.canActivate(context);
    expect(result).toBe(false);
  });

  it('should reject when user is already in another room', async () => {
    const context = createMockContext('device-123', 'room-2');
    mockRedisService.getSession.mockResolvedValue({
      roomId: 'room-1',
      nickname: 'user1',
    });
    const result = await guard.canActivate(context);
    expect(result).toBe(false);
  });

  it('should allow when no session exists', async () => {
    const context = createMockContext('device-123', 'room-1');
    mockRedisService.getSession.mockResolvedValue(null);
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow when session is in the same room', async () => {
    const context = createMockContext('device-123', 'room-1');
    mockRedisService.getSession.mockResolvedValue({
      roomId: 'room-1',
      nickname: 'user1',
    });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});