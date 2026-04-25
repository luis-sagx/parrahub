import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AppMongooseModule } from './mongoose/mongoose.module';
import { AuthModule } from './auth/auth.module';
import { RoomsModule } from './rooms/rooms.module';
import { GatewayModule } from './gateway/gateway.module';
import { MinioModule } from './minio/minio.module';
import { FilesModule } from './files/files.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    BullModule.forRoot({
      connection: process.env.REDIS_URL
        ? { url: process.env.REDIS_URL }
        : {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
          },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    }),
    PrismaModule,
    RedisModule,
    AppMongooseModule,
    AuthModule,
    RoomsModule,
    GatewayModule,
    MinioModule,
    FilesModule,
  ],
})
export class AppModule {}
