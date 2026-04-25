import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    dto: LoginDto,
  ): Promise<{ access_token: string; expiresIn: string }> {
    const admin = await this.prisma.admin.findUnique({
      where: { username: dto.username },
    });

    if (!admin) {
      this.logger.warn(
        `Intento de login fallido para usuario: ${dto.username}`,
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValid = await bcrypt.compare(dto.password, admin.password);
    if (!passwordValid) {
      this.logger.warn(`Password incorrecto para usuario: ${dto.username}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = { sub: admin.id, username: admin.username };
    const access_token = this.jwtService.sign(payload);
    const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

    this.logger.log(`Admin autenticado: ${admin.username}`);
    return { access_token, expiresIn };
  }

  async validateAdmin(adminId: string) {
    return this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, username: true, createdAt: true },
    });
  }
}
