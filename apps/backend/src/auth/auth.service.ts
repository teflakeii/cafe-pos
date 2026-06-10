import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditAction, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

type LoginResponse = {
  accessToken: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async login(input: LoginDto): Promise<LoginResponse> {
    const email = input.email?.trim().toLowerCase();
    const password = input.password;

    this.logger.log(
      JSON.stringify({
        level: 'log',
        context: AuthService.name,
        userId: null,
        action: 'LOGIN_ATTEMPT',
        metadata: {
          email: email ?? null,
        },
      }),
    );

    if (!email || !password) {
      this.logger.warn(
        JSON.stringify({
          level: 'warn',
          context: AuthService.name,
          userId: null,
          action: 'LOGIN_FAILED',
          metadata: {
            reason: 'MISSING_EMAIL_OR_PASSWORD',
            email: email ?? null,
          },
        }),
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        password: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      this.logger.warn(
        JSON.stringify({
          level: 'warn',
          context: AuthService.name,
          userId: user?.id ?? null,
          action: 'LOGIN_FAILED',
          metadata: {
            reason: 'USER_NOT_FOUND_OR_INACTIVE',
            email,
          },
        }),
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      this.logger.warn(
        JSON.stringify({
          level: 'warn',
          context: AuthService.name,
          userId: user.id,
          action: 'LOGIN_FAILED',
          metadata: {
            reason: 'INVALID_PASSWORD',
            email,
          },
        }),
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
    });

    await this.auditService.log(AuditAction.LOGIN, {
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
    });

    this.logger.log(
      JSON.stringify({
        level: 'log',
        context: AuthService.name,
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        metadata: {
          email,
          role: user.role,
        },
      }),
    );

    return {
      accessToken,
    };
  }
}
