import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RoomType } from '@prisma/client';
import { FilesService } from './files.service';

describe('FilesService', () => {
  const mockPrisma = {
    room: { findUnique: jest.fn() },
    fileMetadata: { create: jest.fn(), findMany: jest.fn() },
  };
  
  const mockMinioService = {
    extractKeyFromUrl: jest.fn().mockReturnValue('key-1'),
    buildPublicUrl: jest.fn().mockReturnValue('http://public-url/file.png'),
  };
  
  const mockQueue = { 
    add: jest.fn().mockImplementation(() => Promise.resolve({ id: 'job-123' })) 
  };
  
  let service: FilesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FilesService(
      mockPrisma as never,
      mockMinioService as never,
      mockQueue as never,
    );
  });

  const createMockFile = (
    overrides: Partial<Express.Multer.File> = {},
  ): Express.Multer.File =>
    ({
      originalname: 'test.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('file'),
      fieldname: 'file',
      encoding: '7bit',
      destination: '',
      filename: '',
      path: '',
      stream: undefined as never,
      ...overrides,
    }) as Express.Multer.File;

  describe('validateUpload', () => {
    it('rechaza archivos con MIME no permitido', async () => {
      await expect(
        service.validateUpload(
          createMockFile({ mimetype: 'application/x-msdownload' }),
          'room-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza archivos que superan el maxFileSize de la sala', async () => {
      mockPrisma.room.findUnique.mockResolvedValue({
        id: 'room-1',
        type: RoomType.MULTIMEDIA,
        isActive: true,
        maxFileSize: 1, // 1MB
      });

      await expect(
        service.validateUpload(createMockFile({ size: 2 * 1024 * 1024 }), 'room-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza archivos en salas de solo texto', async () => {
      mockPrisma.room.findUnique.mockResolvedValue({
        id: 'room-1',
        type: RoomType.TEXT,
        isActive: true,
        maxFileSize: 10,
      });

      await expect(
        service.validateUpload(createMockFile(), 'room-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lanza NotFoundException si la sala no existe', async () => {
      mockPrisma.room.findUnique.mockResolvedValue(null);

      await expect(
        service.validateUpload(createMockFile(), 'inexistente'),
      ).rejects.toThrow();
    });

    it('pasa validacion para archivo valido en sala multimedia', async () => {
      mockPrisma.room.findUnique.mockResolvedValue({
        id: 'room-1',
        type: RoomType.MULTIMEDIA,
        isActive: true,
        maxFileSize: 10,
      });

      // Should not throw
      await service.validateUpload(createMockFile(), 'room-1');
    });
  });

  describe('queueUpload', () => {
    it('encola un upload valido', async () => {
      mockPrisma.room.findUnique.mockResolvedValue({
        id: 'room-1',
        type: RoomType.MULTIMEDIA,
        isActive: true,
        maxFileSize: 10,
      });

      const result = await service.queueUpload(createMockFile(), 'room-1', 'Ana');

      expect(mockQueue.add).toHaveBeenCalled();
      expect(result).toHaveProperty('jobId');
    });

    it('rechaza si la sala no existe', async () => {
      mockPrisma.room.findUnique.mockResolvedValue(null);

      await expect(
        service.queueUpload(createMockFile(), 'inexistente', 'user'),
      ).rejects.toThrow();
    });
  });

  describe('saveMetadata', () => {
    it('guarda metadata en PostgreSQL', async () => {
      mockPrisma.fileMetadata.create.mockResolvedValue({ id: 'file-1' });

      await service.saveMetadata(
        'http://file',
        'test.png',
        1024,
        'image/png',
        'room-1',
      );

      expect(mockPrisma.fileMetadata.create).toHaveBeenCalledWith({
        data: {
          url: 'http://file',
          filename: 'test.png',
          size: 1024,
          mimeType: 'image/png',
          roomId: 'room-1',
        },
      });
    });
  });

  describe('getFilesForRoom', () => {
    it('retorna archivos con URLs publicas', async () => {
      mockPrisma.fileMetadata.findMany.mockResolvedValue([
        { id: 'file-1', url: 'http://minio/bucket/key1', filename: 'test.png', size: 100, mimeType: 'image/png', roomId: 'room-1', createdAt: new Date() },
      ]);

      const result = await service.getFilesForRoom('room-1');

      expect(mockPrisma.fileMetadata.findMany).toHaveBeenCalledWith({
        where: { roomId: 'room-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result[0].url).toBe('http://public-url/file.png');
    });

    it('retorna array vacio si no hay archivos', async () => {
      mockPrisma.fileMetadata.findMany.mockResolvedValue([]);

      const result = await service.getFilesForRoom('room-1');

      expect(result).toEqual([]);
    });
  });
});