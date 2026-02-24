import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

type AuditLogOptions = {
  entityType: string;
  entityId?: number;
  userId?: number;
  metadata?: unknown;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(action: AuditAction, options: AuditLogOptions) {
    return this.prisma.auditLog.create({
      data: this.buildCreateInput(action, options),
    });
  }

  async logInTx(tx: Tx, action: AuditAction, options: AuditLogOptions) {
    return tx.auditLog.create({
      data: this.buildCreateInput(action, options),
    });
  }

  async list(page?: number, limit?: number) {
    const safePage = this.parsePage(page);
    const safeLimit = this.parseLimit(limit);
    const skip = (safePage - 1) * safeLimit;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: safeLimit,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          userId: true,
          metadata: true,
          createdAt: true,
          user: {
            select: {
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / safeLimit),
      data: rows,
    };
  }

  private buildCreateInput(
    action: AuditAction,
    options: AuditLogOptions,
  ): Prisma.AuditLogCreateInput {
    const entityType = options.entityType?.trim();
    if (!entityType) {
      throw new BadRequestException('entityType is required for audit log');
    }

    return {
      action,
      entityType,
      entityId: options.entityId,
      metadata: this.toJsonValue(options.metadata),
      ...(options.userId !== undefined
        ? {
            user: {
              connect: {
                id: options.userId,
              },
            },
          }
        : {}),
    };
  }

  private parsePage(value?: number): number {
    const page = value ?? 1;
    if (!Number.isInteger(page) || page <= 0) {
      throw new BadRequestException('page must be a positive integer');
    }
    return page;
  }

  private parseLimit(value?: number): number {
    const limit = value ?? 20;
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new BadRequestException('limit must be a positive integer');
    }
    if (limit > 100) {
      throw new BadRequestException('limit must be less than or equal to 100');
    }
    return limit;
  }

  private toJsonValue(input: unknown): Prisma.InputJsonValue | undefined {
    if (input === undefined) return undefined;
    return input as Prisma.InputJsonValue;
  }
}
