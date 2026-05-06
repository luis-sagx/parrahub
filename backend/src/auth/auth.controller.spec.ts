import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('debe retornar token cuando las credenciales son válidas', async () => {
      const mockDto = { username: 'admin', password: 'password123' };
      const mockResult = { access_token: 'mock-jwt-token' };

      mockAuthService.login.mockResolvedValue(mockResult);

      const result = await controller.login(mockDto);

      expect(authService.login).toHaveBeenCalledWith(mockDto);
      expect(result).toEqual(mockResult);
    });

    it('debe lanzar excepción cuando las credenciales son inválidas', async () => {
      const mockDto = { username: 'admin', password: 'wrong' };

      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Credenciales inválidas'),
      );

      await expect(controller.login(mockDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('debe aceptar diferentes usernames', async () => {
      const mockDto = { username: 'otro-usuario', password: 'password123' };
      const mockResult = { access_token: 'token-otro' };

      mockAuthService.login.mockResolvedValue(mockResult);

      const result = await controller.login(mockDto);

      expect(result).toEqual(mockResult);
    });
  });
});