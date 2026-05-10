import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { DisconnectChatDto } from './dto/disconnect-chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatGateway: ChatGateway) {}

  @Post('disconnect')
  @HttpCode(204)
  async disconnect(@Body() payload: DisconnectChatDto): Promise<void> {
    await this.chatGateway.disconnectDeviceFromRoom(payload);
  }
}
