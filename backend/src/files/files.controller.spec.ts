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

    it('debe subir archivo si hay sesion activa', async () => {
      const mockDto = { roomId: 'room-1', nickname: 'user1' };
      const mockSession = { roomId: 'room-1', nickname: 'user1', joinedAt: Date.now() };
      const mockResult = { jobId: 'job-123', status: 'queued' };

      mockRedisService.getSession.mockResolvedValue(mockSession);
      mockFilesService.queueUpload.mockResolvedValue(mockResult);

      const result = await controller.upload(mockFile, mockDto, 'device-123');

      expect(redisService.getSession).toHaveBeenCalledWith('device-123');
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

      await controller.upload(mockFile, mockDto, 'device-123');

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
        controller.upload(mockFile, mockDto, 'device-123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('debe lanzar UnauthorizedException si la sesion es de otra sala', async () => {
      const mockDto = { roomId: 'room-1', nickname: 'user1' };
      const mockSession = { roomId: 'room-2', nickname: 'user1', joinedAt: Date.now() };

      mockRedisService.getSession.mockResolvedValue(mockSession);

      await expect(
        controller.upload(mockFile, mockDto, 'device-123'),
      ).rejects.toThrow(UnauthorizedException);
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