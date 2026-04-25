import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FileProcessor } from './file.processor';
import { FILE_PROCESSING_QUEUE } from './files.constants';
import { MinioModule } from '../minio/minio.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { GatewayModule } from '../gateway/gateway.module';
import { MessageSchema } from '../mongoose/message.schema';

@Module({
  imports: [
    BullModule.registerQueue({ name: FILE_PROCESSING_QUEUE }),
    MulterModule.register({
      storage: memoryStorage(),
    }),
    MongooseModule.forFeature([{ name: 'Message', schema: MessageSchema }]),
    MinioModule,
    PrismaModule,
    RedisModule,
    GatewayModule,
  ],
  controllers: [FilesController],
  providers: [FilesService, FileProcessor],
  exports: [FilesService],
})
export class FilesModule {}
