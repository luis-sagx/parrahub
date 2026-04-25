import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RoomType } from '@prisma/client';
import { FilesService } from './files.service';

describe('FilesService', () => {
  const prisma = {
    room: { findUnique: jest.fn() },
    fileMetadata: { create: jest.fn(), findMany: jest.fn() },
  };
  const queue = { add: jest.fn() };
  let service: FilesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FilesService(prisma as never, queue as never);
  });

  const file = (
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

  it('rechaza archivos con MIME no permitido', async () => {
    await expect(
      service.validateUpload(
        file({ mimetype: 'application/x-msdownload' }),
        'room-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza archivos que superan el maxFileSize de la sala', async () => {
    prisma.room.findUnique.mockResolvedValue({
      id: 'room-1',
      type: RoomType.MULTIMEDIA,
      isActive: true,
      maxFileSize: 1,
    });

    await expect(
      service.validateUpload(file({ size: 2 * 1024 * 1024 }), 'room-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza archivos en salas de solo texto', async () => {
    prisma.room.findUnique.mockResolvedValue({
      id: 'room-1',
      type: RoomType.TEXT,
      isActive: true,
      maxFileSize: 10,
    });

    await expect(
      service.validateUpload(file(), 'room-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('encola un upload valido', async () => {
    prisma.room.findUnique.mockResolvedValue({
      id: 'room-1',
      type: RoomType.MULTIMEDIA,
      isActive: true,
      maxFileSize: 10,
    });
    queue.add.mockResolvedValue({ id: 'job-1' });

    await expect(service.queueUpload(file(), 'room-1', 'Ana')).resolves.toEqual(
      {
        jobId: 'job-1',
      },
    );
  });

  it('guarda metadata en PostgreSQL', async () => {
    prisma.fileMetadata.create.mockResolvedValue({ id: 'file-1' });

    await service.saveMetadata(
      'http://file',
      'test.png',
      1024,
      'image/png',
      'room-1',
    );

    expect(prisma.fileMetadata.create).toHaveBeenCalledWith({
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
