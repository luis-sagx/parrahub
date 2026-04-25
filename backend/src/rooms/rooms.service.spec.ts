import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

interface RoomData {
  id: string;
  name: string;
  type: string;
  adminId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  maxFileSize: number;
  pin?: string;
}

describe('RoomsService', () => {
  let service: RoomsService;

  const mockPrisma = {
    room: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<RoomsService>(RoomsService);
    jest.clearAllMocks();
  });

  it('create hashea el PIN antes de guardar', async () => {
    mockPrisma.room.create.mockImplementation(
      async ({ data }: { data: RoomData }) => ({
        ...data,
        id: 'uuid-1',
      }),
    );
    await service.create('admin-1', {
      name: 'Sala Test',
      type: 'TEXT',
      pin: '1234',
    });
    const calledWith = mockPrisma.room.create.mock.calls[0][0].data as {
      pin: string;
    };
    expect(calledWith.pin).not.toBe('1234');
    expect(await bcrypt.compare('1234', calledWith.pin)).toBe(true);
  });

  it('findAll nunca retorna el campo pin', async () => {
    const mockRoomData: RoomData = {
      id: '1',
      name: 'Sala',
      type: 'TEXT',
      adminId: 'a1',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      maxFileSize: 10,
    };
    mockPrisma.room.findMany.mockResolvedValue([mockRoomData]);
    const rooms = await service.findAll('a1');
    rooms.forEach((r) => expect(r).not.toHaveProperty('pin'));
  });

  it('validatePin retorna true con PIN correcto', async () => {
    const hash = await bcrypt.hash('5678', 10);
    mockPrisma.room.findUnique.mockResolvedValue({ pin: hash, isActive: true });
    expect(await service.validatePin('room-1', '5678')).toBe(true);
  });

  it('validatePin retorna false con PIN incorrecto', async () => {
    const hash = await bcrypt.hash('5678', 10);
    mockPrisma.room.findUnique.mockResolvedValue({ pin: hash, isActive: true });
    expect(await service.validatePin('room-1', '0000')).toBe(false);
  });

  it('delete lanza ForbiddenException si la sala no pertenece al admin', async () => {
    mockPrisma.room.findUnique.mockResolvedValue({
      id: 'r1',
      adminId: 'otro-admin',
    });
    await expect(service.delete('r1', 'mi-admin')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
