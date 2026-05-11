import { Test, TestingModule } from '@nestjs/testing';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { RedisService } from '../redis/redis.service';
import { UnauthorizedException } from '@nestjs/common';

describe('FilesController', () => {
  let controller: FilesController;
  let filesService: FilesService;
  let redisService: RedisService;

  const mockFilesService = {
    queueUpload: jest.fn(),
    getFilesForRoom: jest.fn(),
  };

  const mockRedisService = {
    getSession: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        { provide: FilesService, useValue: mockFilesService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    controller = module.get<FilesController>(FilesController);
    filesService = module.get<FilesService>(FilesService);
    redisService = module.get<RedisService>(RedisService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('upload', () => {
    const mockFile = {
      originalname: 'test.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('test'),
    } as Express.Multer.File;
    const mockReq = {
      headers: { 'x-device-fingerprint': 'fp-123' },
      ip: '127.0.0.1',
      socket: {},
    } as any;

    it('debe subir archivo si hay sesion activa', async () => {
      const mockDto = { roomId: 'room-1', nickname: 'user1' };
      const mockSession = { roomId: 'room-1', nickname: 'user1', joinedAt: Date.now() };
      const mockResult = { jobId: 'job-123', status: 'queued' };

      mockRedisService.getSession.mockResolvedValue(mockSession);
      mockFilesService.queueUpload.mockResolvedValue(mockResult);

      const result = await controller.upload(mockFile, mockDto, mockReq);

      expect(redisService.getSession).toHaveBeenCalledWith(
        'ip:127.0.0.1:fp:fp-123',
      );
      expect(filesService.queueUpload).toHaveBeenCalledWith(
        mockFile,
        'room-1',
        'user1',
      );
      expect(result).toEqual(mockResult);
    });

    it('debe usar nickname del dto si no esta en sesion', async () => {
      const mockDto = { roomId: 'room-1', nickname: 'user1' };
      const mockSession = { roomId: 'room-1', nickname: undefined, joinedAt: Date.now() };
      const mockResult = { jobId: 'job-123', status: 'queued' };

      mockRedisService.getSession.mockResolvedValue(mockSession);
      mockFilesService.queueUpload.mockResolvedValue(mockResult);

      await controller.upload(mockFile, mockDto, mockReq);

      expect(filesService.queueUpload).toHaveBeenCalledWith(
        mockFile,
        'room-1',
        'user1',
      );
    });

    it('debe lanzar UnauthorizedException si no hay sesion', async () => {
      const mockDto = { roomId: 'room-1', nickname: 'user1' };

      mockRedisService.getSession.mockResolvedValue(null);

      await expect(
        controller.upload(mockFile, mockDto, mockReq),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('debe lanzar UnauthorizedException si la sesion es de otra sala', async () => {
      const mockDto = { roomId: 'room-1', nickname: 'user1' };
      const mockSession = { roomId: 'room-2', nickname: 'user1', joinedAt: Date.now() };

      mockRedisService.getSession.mockResolvedValue(mockSession);

      await expect(
        controller.upload(mockFile, mockDto, mockReq),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('debe usar x-forwarded-for array cuando es un array', async () => {
      const req = {
        headers: { 'x-forwarded-for': ['10.0.0.1', '10.0.0.2'], 'x-device-fingerprint': 'fp-123' },
        ip: '127.0.0.1',
        socket: {},
      } as any;
      const session = { roomId: 'room-1', nickname: 'user1', joinedAt: Date.now() };
      mockRedisService.getSession.mockResolvedValue(session);
      mockFilesService.queueUpload.mockResolvedValue({ jobId: 'job-123' });

      await controller.upload(mockFile, { roomId: 'room-1', nickname: 'user1' }, req);

      expect(redisService.getSession).toHaveBeenCalledWith('ip:10.0.0.1:fp:fp-123');
    });

    it('debe usar x-forwarded-for string con coma', async () => {
      const req = {
        headers: { 'x-forwarded-for': '10.0.0.1,10.0.0.2', 'x-device-fingerprint': 'fp-123' },
        ip: '127.0.0.1',
        socket: {},
      } as any;
      const session = { roomId: 'room-1', nickname: 'user1', joinedAt: Date.now() };
      mockRedisService.getSession.mockResolvedValue(session);
      mockFilesService.queueUpload.mockResolvedValue({ jobId: 'job-123' });

      await controller.upload(mockFile, { roomId: 'room-1', nickname: 'user1' }, req);

      expect(redisService.getSession).toHaveBeenCalledWith('ip:10.0.0.1:fp:fp-123');
    });

    it('debe usar x-device-fingerprint array cuando es un array', async () => {
      const req = {
        headers: { 'x-device-fingerprint': ['fp-array', 'fp-other'] },
        ip: '127.0.0.1',
        socket: {},
      } as any;
      const session = { roomId: 'room-1', nickname: 'user1', joinedAt: Date.now() };
      mockRedisService.getSession.mockResolvedValue(session);
      mockFilesService.queueUpload.mockResolvedValue({ jobId: 'job-123' });

      await controller.upload(mockFile, { roomId: 'room-1', nickname: 'user1' }, req);

      expect(redisService.getSession).toHaveBeenCalledWith('ip:127.0.0.1:fp:fp-array');
    });

    it('debe usar solo sessionLockKey cuando no hay fingerprint', async () => {
      const req = {
        headers: {},
        ip: '127.0.0.1',
        socket: {},
      } as any;
      const session = { roomId: 'room-1', nickname: 'user1', joinedAt: Date.now() };
      mockRedisService.getSession.mockResolvedValue(session);
      mockFilesService.queueUpload.mockResolvedValue({ jobId: 'job-123' });

      await controller.upload(mockFile, { roomId: 'room-1', nickname: 'user1' }, req);

      expect(redisService.getSession).toHaveBeenCalledWith('ip:127.0.0.1');
    });

    it('usa sessionLockKey como fallback cuando sessionKey no tiene sesion', async () => {
      const req = {
        headers: { 'x-device-fingerprint': 'fp-123' },
        ip: '127.0.0.1',
        socket: {},
      } as any;
      const session = { roomId: 'room-1', nickname: 'user1', joinedAt: Date.now() };
      mockRedisService.getSession
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(session);
      mockFilesService.queueUpload.mockResolvedValue({ jobId: 'job-123' });

      const result = await controller.upload(mockFile, { roomId: 'room-1', nickname: 'user1' }, req);

      expect(redisService.getSession).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ jobId: 'job-123', status: 'queued' });
    });

    it('usa socket.remoteAddress cuando no hay ip ni forwarded-for', async () => {
      const req = {
        headers: {},
        ip: undefined,
        socket: { remoteAddress: '192.168.1.1' },
      } as any;
      const session = { roomId: 'room-1', nickname: 'user1', joinedAt: Date.now() };
      mockRedisService.getSession.mockResolvedValue(session);
      mockFilesService.queueUpload.mockResolvedValue({ jobId: 'job-123' });

      await controller.upload(mockFile, { roomId: 'room-1', nickname: 'user1' }, req);

      expect(redisService.getSession).toHaveBeenCalledWith('ip:192.168.1.1');
    });

    it('usa string vacio como fallback cuando no hay ninguna ip disponible', async () => {
      const req = {
        headers: {},
        ip: undefined,
        socket: {},
      } as any;
      mockRedisService.getSession.mockResolvedValue(null);

      await expect(
        controller.upload(mockFile, { roomId: 'room-1', nickname: 'user1' }, req),
      ).rejects.toThrow(UnauthorizedException);

      expect(redisService.getSession).toHaveBeenCalledWith('ip:');
    });
  });

  describe('getFilesForRoom', () => {
    it('debe retornar archivos de una sala', async () => {
      const mockFiles = [
        { id: 'file-1', url: 'http://example.com/file1.png', filename: 'file1.png' },
      ];

      mockFilesService.getFilesForRoom.mockResolvedValue(mockFiles);

      const result = await controller.getFilesForRoom('room-1');

      expect(filesService.getFilesForRoom).toHaveBeenCalledWith('room-1');
      expect(result).toEqual(mockFiles);
    });
  });
});
