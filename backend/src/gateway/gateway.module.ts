import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { RoomsModule } from '../rooms/rooms.module';
import { EncryptionModule } from '../encryption/encryption.module';
import { MessageSchema } from '../mongoose/message.schema';

@Module({
  imports: [
    RoomsModule,
    EncryptionModule,
    MongooseModule.forFeature([{ name: 'Message', schema: MessageSchema }]),
  ],
  controllers: [ChatController],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class GatewayModule {}
