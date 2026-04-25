import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RoomType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ALLOWED_MIME_TYPES,
  DEFAULT_MAX_FILE_SIZE_MB,
  FILE_PROCESSING_QUEUE,
} from './files.constants';

export interface UploadJobData {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
  roomId: string;
  nickname: string;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(FILE_PROCESSING_QUEUE)
    private readonly fileQueue: Queue<UploadJobData>,
  ) {}

  async validateUpload(file: Express.Multer.File | undefined, roomId: string) {
    if (!file) throw new BadRequestException('Archivo no proporcionado');
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido: ${file.mimetype}`,
      );
    }

    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room || !room.isActive)
      throw new NotFoundException('Sala no encontrada');
    if (room.type !== RoomType.MULTIMEDIA) {
      throw new ForbiddenException('La sala no permite archivos');
    }

    const maxMb = room.maxFileSize || DEFAULT_MAX_FILE_SIZE_MB;
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `El archivo supera el límite de ${maxMb}MB`,
      );
    }
  }

  async queueUpload(
    file: Express.Multer.File,
    roomId: string,
    nickname: string,
  ): Promise<{ jobId: string }> {
    await this.validateUpload(file, roomId);

    const job = await this.fileQueue.add(
      'upload',
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        roomId,
        nickname,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    return { jobId: String(job.id) };
  }

  async saveMetadata(
    url: string,
    filename: string,
    size: number,
    mimeType: string,
    roomId: string,
  ) {
    return this.prisma.fileMetadata.create({
      data: { url, filename, size, mimeType, roomId },
    });
  }

  async getFilesForRoom(roomId: string) {
    return this.prisma.fileMetadata.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
