import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';

export type AdminUserRow = {
  id: number;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
};

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listUsers(): Promise<AdminUserRow[]> {
    const rows = await this.prisma.user.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      active: row.isActive,
      createdAt: row.createdAt,
    }));
  }

  async createUser(input: CreateAdminUserDto): Promise<AdminUserRow> {
    const email = input.email.trim().toLowerCase();
    const password = input.password;

    if (!email) {
      throw new BadRequestException('email is required');
    }

    if (!password) {
      throw new BadRequestException('password is required');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const created = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role: input.role,
          isActive: input.isActive ?? true,
        },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      return {
        id: created.id,
        email: created.email,
        role: created.role,
        active: created.isActive,
        createdAt: created.createdAt,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }

      throw error;
    }
  }

  async updateUserRole(
    id: number,
    role: UserRole,
    actorUserId: number,
  ): Promise<AdminUserRow> {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
      },
    });

    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (target.id === actorUserId && target.role !== role) {
      throw new ConflictException('Cannot change your own role');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        role,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await this.auditService.log(AuditAction.USER_ROLE_CHANGED, {
      entityType: 'User',
      entityId: id,
      userId: actorUserId,
      metadata: {
        fromRole: target.role,
        toRole: role,
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      active: updated.isActive,
      createdAt: updated.createdAt,
    };
  }

  async setUserActive(
    id: number,
    active: boolean,
    actorUserId: number,
  ): Promise<AdminUserRow> {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (target.id === actorUserId && !active) {
      throw new ConflictException('Cannot deactivate your own account');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: active,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      active: updated.isActive,
      createdAt: updated.createdAt,
    };
  }
}
