import { Logger } from '@nestjs/common';
import { FileProcessor } from './file.processor';
import { MinioService } from '../minio/minio.service';
import { FilesService } from './files.service';
import { ChatGateway } from '../gateway/chat.gateway';
import { RedisService } from '../redis/redis.service';

describe('FileProcessor', () => {
  let processor: FileProcessor;

  const mockMinioService = {
    uploadFile: jest.fn(),
  };

  const mockFilesService = {
    saveMetadata: jest.fn(),
  };

  const mockChatGateway = {
    normalizeStoredMessage: jest.fn((msg) => msg),
  };

  const mockRedisService = {
    getRoomUsers: jest.fn(),
    getClient: jest.fn().mockReturnValue({
      publish: jest.fn().mockResolvedValue(1),
    }),
  };

  const mockMessageModel = {
    create: jest.fn(),
  };

  beforeEach(() => {
    processor = new FileProcessor(
      mockMinioService as never,
      mockFilesService as never,
      mockChatGateway as never,
      mockRedisService as never,
      mockMessageModel as never,
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('debe retornar temprano si el job no es de tipo upload', async () => {
    const mockJob = {
      name: 'other-job',
      data: {},
      updateProgress: jest.fn(),
    };

    const result = await processor.process(mockJob as never);

    expect(result).toBeUndefined();
    expect(mockMinioService.uploadFile).not.toHaveBeenCalled();
  });

  it('debe procesar un archivo exitosamente', async () => {
    const mockJob = {
      name: 'upload',
      data: {
        buffer: Buffer.from('file content'),
        originalname: 'test.png',
        mimetype: 'image/png',
        size: 1024,
        roomId: 'room-1',
        nickname: 'user1',
      },
      updateProgress: jest.fn(),
    };

    mockMinioService.uploadFile.mockResolvedValue('http://minio/file.png');
    mockFilesService.saveMetadata.mockResolvedValue({ id: 'file-1' });
    mockRedisService.getRoomUsers.mockResolvedValue(['user1', 'user2']);
    mockMessageModel.create.mockResolvedValue({
      toObject: () => ({ id: 'msg-1', content: 'test.png' }),
    });

    const result = await processor.process(mockJob as never);

    expect(mockMinioService.uploadFile).toHaveBeenCalled();
    expect(mockFilesService.saveMetadata).toHaveBeenCalledWith(
      'http://minio/file.png',
      'test.png',
      1024,
      'image/png',
      'room-1',
    );
    expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
    expect(result).toEqual({
      url: 'http://minio/file.png',
      metadataId: 'file-1',
    });
  });

  it('debe manejar buffers que no son Buffer correctamente', async () => {
    const mockJob = {
      name: 'upload',
      data: {
        buffer: new Uint8Array([1, 2, 3]), // ArrayBuffer-like
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 3,
        roomId: 'room-1',
        nickname: 'user1',
      },
      updateProgress: jest.fn(),
    };

    mockMinioService.uploadFile.mockResolvedValue('http://minio/file.txt');
    mockFilesService.saveMetadata.mockResolvedValue({ id: 'file-1' });
    mockRedisService.getRoomUsers.mockResolvedValue(['user1']);
    mockMessageModel.create.mockResolvedValue({
      toObject: () => ({ id: 'msg-1' }),
    });

    await processor.process(mockJob as never);

    expect(mockMinioService.uploadFile).toHaveBeenCalled();
  });
});