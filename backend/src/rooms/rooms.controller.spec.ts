import { Test, TestingModule } from '@nestjs/testing';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';

// Mock JwtAuthGuard
jest.mock('../auth/auth.guard', () => ({
  JwtAuthGuard: class {
    canActivate() {
      return true;
    }
  },
}));

describe('RoomsController', () => {
  let controller: RoomsController;
  let roomsService: RoomsService;

  const mockRoomsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findPublic: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };

  const mockMessageModel = {
    find: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomsController],
      providers: [
        { provide: RoomsService, useValue: mockRoomsService },
        { provide: getModelToken('Message'), useValue: mockMessageModel },
      ],
    }).compile();

    controller = module.get<RoomsController>(RoomsController);
    roomsService = module.get<RoomsService>(RoomsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('debe crear una sala con el adminId del request', async () => {
      const mockDto = { name: 'Nueva Sala', type: 'TEXT', pin: '1234' };
      const mockReq = { admin: { sub: 'admin-123' } };
      const mockResult = { id: 'room-1', name: 'Nueva Sala', type: 'TEXT' };

      mockRoomsService.create.mockResolvedValue(mockResult);

      const result = await controller.create(mockDto, mockReq);

      expect(roomsService.create).toHaveBeenCalledWith('admin-123', mockDto);
      expect(result).toEqual(mockResult);
    });

    it('debe usar string vacio si no hay admin', async () => {
      const mockDto = { name: 'Nueva Sala', type: 'TEXT', pin: '1234' };
      const mockReq = {};

      mockRoomsService.create.mockResolvedValue({});

      await controller.create(mockDto, mockReq);

      expect(roomsService.create).toHaveBeenCalledWith('', mockDto);
    });
  });

  describe('findAll', () => {
    it('debe retornar todas las salas activas', async () => {
      const mockRooms = [
        { id: 'room-1', name: 'Sala 1', type: 'TEXT' },
        { id: 'room-2', name: 'Sala 2', type: 'MULTIMEDIA' },
      ];

      mockRoomsService.findAll.mockResolvedValue(mockRooms);

      const result = await controller.findAll();

      expect(roomsService.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockRooms);
    });
  });

  describe('findPublic', () => {
    it('debe retornar salas publicas', async () => {
      const mockRooms = [{ id: 'room-1', name: 'Sala Publica' }];

      mockRoomsService.findPublic.mockResolvedValue(mockRooms);

      const result = await controller.findPublic();

      expect(roomsService.findPublic).toHaveBeenCalled();
      expect(result).toEqual(mockRooms);
    });
  });

  describe('findOne', () => {
    it('debe retornar una sala por id', async () => {
      const mockRoom = { id: 'room-1', name: 'Sala 1' };

      mockRoomsService.findOne.mockResolvedValue(mockRoom);

      const result = await controller.findOne('room-1');

      expect(roomsService.findOne).toHaveBeenCalledWith('room-1');
      expect(result).toEqual(mockRoom);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      mockRoomsService.findOne.mockRejectedValue(
        new NotFoundException('Sala no encontrada'),
      );

      await expect(controller.findOne('inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('debe eliminar una sala', async () => {
      const mockReq = { admin: { sub: 'admin-123' } };

      mockRoomsService.delete.mockResolvedValue(undefined);

      await controller.delete('room-1', mockReq);

      expect(roomsService.delete).toHaveBeenCalledWith('room-1', 'admin-123');
    });

    it('debe lanzar ForbiddenException si no tiene permisos', async () => {
      const mockReq = { admin: { sub: 'admin-123' } };

      mockRoomsService.delete.mockRejectedValue(
        new ForbiddenException('No tienes permiso'),
      );

      await expect(controller.delete('room-1', mockReq)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getMessages', () => {
    it('debe retornar mensajes de una sala', async () => {
      const mockMessages = [
        { id: 'msg-1', content: 'Hola', timestamp: new Date() },
      ];

      mockRoomsService.findOne.mockResolvedValue({ id: 'room-1' });
      mockMessageModel.find.mockReturnThis();
      mockMessageModel.sort.mockReturnThis();
      mockMessageModel.limit.mockReturnThis();
      mockMessageModel.lean.mockReturnThis();
      mockMessageModel.exec.mockResolvedValue(mockMessages);

      const result = await controller.getMessages('room-1');

      expect(roomsService.findOne).toHaveBeenCalledWith('room-1');
      expect(result).toEqual(mockMessages);
    });
  });
});