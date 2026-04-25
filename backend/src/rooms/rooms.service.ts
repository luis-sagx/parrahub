import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(adminId: string, dto: CreateRoomDto) {
    const hashedPin = await bcrypt.hash(dto.pin, 10);

    const room = await this.prisma.room.create({
      data: {
        name: dto.name,
        type: dto.type,
        pin: hashedPin,
        maxFileSize: dto.maxFileSize ?? 10,
        adminId,
      },
    });

    this.logger.log(
      `Sala creada: "${room.name}" (${room.type}) por admin ${adminId}`,
    );

    const { pin: _hashed, ...roomWithoutPin } = room;
    return roomWithoutPin;
  }

  async findAll(adminId: string) {
    const rooms = await this.prisma.room.findMany({
      where: { adminId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return rooms.map(({ pin: _hashed, ...r }) => r);
  }

  async findOne(id: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException(`Sala ${id} no encontrada`);

    const { pin: _hashed, ...roomWithoutPin } = room;
    return roomWithoutPin;
  }

  async delete(id: string, adminId: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException(`Sala ${id} no encontrada`);
    if (room.adminId !== adminId)
      throw new ForbiddenException('No tienes permiso para eliminar esta sala');

    await this.prisma.room.update({
      where: { id },
      data: { isActive: false },
    });
    this.logger.log(`Sala eliminada: ${id}`);
  }

  async validatePin(roomId: string, pin: string): Promise<boolean> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room || !room.isActive) return false;
    return bcrypt.compare(pin, room.pin);
  }

  async getRoomWithPin(roomId: string) {
    return this.prisma.room.findUnique({ where: { id: roomId } });
  }
}
