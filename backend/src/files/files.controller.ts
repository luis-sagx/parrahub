import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Headers,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { RedisService } from '../redis/redis.service';
import { UploadFileDto } from './dto/upload-file.dto';

@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly redisService: RedisService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @Headers('x-device-id') deviceId: string,
  ) {
    const session = await this.redisService.getSession(deviceId);
    if (!session || session.roomId !== dto.roomId) {
      throw new UnauthorizedException(
        'Debes estar unido a la sala para subir archivos',
      );
    }

    const { jobId } = await this.filesService.queueUpload(
      file,
      dto.roomId,
      session.nickname || dto.nickname,
    );

    return { jobId, status: 'queued' };
  }

  @Get('room/:roomId')
  getFilesForRoom(@Param('roomId') roomId: string) {
    return this.filesService.getFilesForRoom(roomId);
  }
}
