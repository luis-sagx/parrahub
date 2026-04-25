import { Global, Module } from '@nestjs/common';
import { MongooseModule as NestMongooseModule } from '@nestjs/mongoose';
import { MessageSchema } from './message.schema';

@Global()
@Module({
  imports: [
    NestMongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI,
      }),
    }),
    NestMongooseModule.forFeature([{ name: 'Message', schema: MessageSchema }]),
  ],
  exports: [NestMongooseModule],
})
export class AppMongooseModule {}
