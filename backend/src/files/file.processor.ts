import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FILE_PROCESSING_QUEUE } from './files.constants';
import { FilesService, UploadJobData } from './files.service';
import { MinioService } from '../minio/minio.service';
import { ChatGateway } from '../gateway/chat.gateway';
import { Message } from '../mongoose/message.schema';

@Processor(FILE_PROCESSING_QUEUE)
export class FileProcessor extends WorkerHost {
  private readonly logger = new Logger(FileProcessor.name);

  constructor(
    private readonly minioService: MinioService,
    private readonly filesService: FilesService,
    private readonly chatGateway: ChatGateway,
    @InjectModel('Message') private readonly messageModel: Model<Message>,
  ) {
    super();
  }

  async process(job: Job<UploadJobData>) {
    if (job.name !== 'upload') return;

    const { buffer, originalname, mimetype, size, roomId, nickname } = job.data;
    const fileBuffer = Buffer.isBuffer(buffer)
      ? buffer
      : Buffer.from(buffer as unknown as ArrayBuffer);

    const url = await this.minioService.uploadFile(
      fileBuffer,
      originalname,
      mimetype,
    );
    const metadata = await this.filesService.saveMetadata(
      url,
      originalname,
      size,
      mimetype,
      roomId,
    );

    const message = {
      roomId,
      nickname,
      content: originalname,
      type: 'file' as const,
      fileUrl: url,
      filename: originalname,
      mimeType: mimetype,
      reactions: [],
      timestamp: new Date(),
    };

    const storedMessage = await this.messageModel.create(message);
    this.chatGateway.server?.to(roomId).emit('new-file', {
      ...metadata,
      nickname,
    });
    this.chatGateway.server?.to(roomId).emit(
      'new-message',
      this.chatGateway.normalizeStoredMessage(
        storedMessage.toObject() as unknown as Record<string, unknown>,
      ),
    );
    await job.updateProgress(100);

    this.logger.log(`Archivo procesado para sala ${roomId}: ${originalname}`);
    return { url, metadataId: metadata.id };
  }
}
