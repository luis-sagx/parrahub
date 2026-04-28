import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JwtAuthGuard } from '../auth/auth.guard';

interface AuthRequest extends Request {
  admin?: {
    sub: string;
  };
}

@Controller('rooms')
export class RoomsController {
  private readonly logger = new Logger(RoomsController.name);

  constructor(
    private readonly roomsService: RoomsService,
    @InjectModel('Message') private readonly messageModel: Model<unknown>,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateRoomDto, @Request() req: AuthRequest) {
    const adminId = req.admin?.sub ?? '';
    return this.roomsService.create(adminId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.roomsService.findAll();
  }

  @Get('public')
  findPublic() {
    return this.roomsService.findPublic();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string, @Request() req: AuthRequest) {
    const adminId = req.admin?.sub ?? '';
    return this.roomsService.delete(id, adminId);
  }

  @Get(':id/messages')
  async getMessages(@Param('id') id: string) {
    // Verify the room exists
    await this.roomsService.findOne(id);

    const messages = await this.messageModel
      .find({ roomId: id })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean()
      .exec();
    return messages.reverse();
  }
}
