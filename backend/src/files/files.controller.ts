import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
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

  private getRequestSessionKeys(req: Request): {
    sessionKey: string;
    sessionLockKey: string;
  } {
    // Usa la misma identidad IP/fingerprint del gateway para autorizar uploads.
    const forwardedFor = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0];
    const fingerprintHeader = req.headers['x-device-fingerprint'];
    const fingerprint = (Array.isArray(fingerprintHeader)
      ? fingerprintHeader[0]
      : fingerprintHeader
    )
      ?.trim()
      .replace(/[^a-zA-Z0-9_-]/g, '');
    // sessionLockKey bloquea el origen base; sessionKey distingue el fingerprint cuando existe.
    const sessionLockKey = `ip:${ip?.trim() || req.ip || req.socket.remoteAddress || ''}`;

    return {
      sessionKey: fingerprint
        ? `${sessionLockKey}:fp:${fingerprint}`
        : sessionLockKey,
      sessionLockKey,
    };
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @Req() req: Request,
  ) {
    const { sessionKey, sessionLockKey } = this.getRequestSessionKeys(req);
    // Permite subir archivos solo si el socket de esa sala tiene sesion activa.
    const session =
      (await this.redisService.getSession(sessionKey)) ??
      (await this.redisService.getSession(sessionLockKey));
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
