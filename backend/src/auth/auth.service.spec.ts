import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    admin: { findUnique: jest.fn() },
  };
  const mockJwt = {
    sign: jest.fn().mockReturnValue('mock-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('login exitoso devuelve access_token', async () => {
    const hash = await bcrypt.hash('Admin1234!', 10);
    mockPrisma.admin.findUnique.mockResolvedValue({
      id: '1',
      username: 'admin',
      password: hash,
    });
    const result = await service.login({
      username: 'admin',
      password: 'Admin1234!',
    });
    expect(result.access_token).toBe('mock-token');
  });

  it('lanza UnauthorizedException si el usuario no existe', async () => {
    mockPrisma.admin.findUnique.mockResolvedValue(null);
    await expect(
      service.login({ username: 'nadie', password: '12345678' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('lanza UnauthorizedException si la contraseña es incorrecta', async () => {
    const hash = await bcrypt.hash('Admin1234!', 10);
    mockPrisma.admin.findUnique.mockResolvedValue({
      id: '1',
      username: 'admin',
      password: hash,
    });
    await expect(
      service.login({ username: 'admin', password: 'wrongpassword' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
