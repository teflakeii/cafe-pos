import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const IDEMPOTENCY_PENDING = '__PENDING__';
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9:_.-]{8,255}$/;

type ExecuteIdempotentOptions<T> = {
  idempotencyKey?: string;
  userId?: number;
  endpoint: string;
  action: () => Promise<T>;
};

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(options: ExecuteIdempotentOptions<T>): Promise<T> {
    const key = this.normalizeKey(options.idempotencyKey);
    const userId = this.normalizeUserId(options.userId);
    const endpoint = this.normalizeEndpoint(options.endpoint);

    const uniqueWhere = {
      key_userId_endpoint: {
        key,
        userId,
        endpoint,
      },
    } as const;

    const existing = await this.prisma.idempotency.findUnique({
      where: uniqueWhere,
      select: {
        responseHash: true,
      },
    });

    if (existing) {
      return this.replayOrReject<T>(existing.responseHash, key, endpoint, userId);
    }

    let lockAcquired = false;

    try {
      await this.prisma.idempotency.create({
        data: {
          key,
          userId,
          endpoint,
          responseHash: IDEMPOTENCY_PENDING,
        },
      });
      lockAcquired = true;
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const row = await this.prisma.idempotency.findUnique({
        where: uniqueWhere,
        select: {
          responseHash: true,
        },
      });

      if (!row) {
        throw new ConflictException('Idempotency conflict detected');
      }

      return this.replayOrReject<T>(row.responseHash, key, endpoint, userId);
    }

    if (!lockAcquired) {
      throw new ConflictException('Idempotency lock was not acquired');
    }

    try {
      const result = await options.action();
      const serialized = this.serialize(result);

      await this.prisma.idempotency.update({
        where: uniqueWhere,
        data: {
          responseHash: serialized,
        },
      });

      return result;
    } catch (error) {
      await this.prisma.idempotency
        .delete({ where: uniqueWhere })
        .catch(() => undefined);
      throw error;
    }
  }

  private replayOrReject<T>(
    responseHash: string,
    key: string,
    endpoint: string,
    userId: number,
  ): T {
    if (responseHash === IDEMPOTENCY_PENDING) {
      throw new ConflictException(
        'A request with this Idempotency-Key is still in progress',
      );
    }

    try {
      return JSON.parse(responseHash) as T;
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: 'error',
          context: IdempotencyService.name,
          userId,
          action: 'IDEMPOTENCY_REPLAY_PARSE_FAILED',
          metadata: {
            endpoint,
            key,
            error: error instanceof Error ? error.message : String(error),
          },
        }),
      );

      throw new InternalServerErrorException(
        'Stored idempotency response is invalid',
      );
    }
  }

  private normalizeKey(rawKey?: string): string {
    const key = rawKey?.trim();

    if (!key) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
      throw new BadRequestException('Idempotency-Key is invalid');
    }

    return key;
  }

  private normalizeUserId(userId?: number): number {
    if (!Number.isInteger(userId) || (userId ?? 0) <= 0) {
      throw new BadRequestException('Authenticated user is required');
    }

    return userId;
  }

  private normalizeEndpoint(endpoint: string): string {
    const value = endpoint.trim();

    if (!value) {
      throw new BadRequestException('Endpoint identifier is required');
    }

    return value;
  }

  private serialize<T>(payload: T): string {
    try {
      return JSON.stringify(payload);
    } catch {
      throw new InternalServerErrorException('Failed to serialize response');
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return false;
    }

    const target = error.meta?.target;
    if (Array.isArray(target)) {
      return (
        target.includes('key') &&
        target.includes('userId') &&
        target.includes('endpoint')
      );
    }

    if (typeof target === 'string') {
      return (
        target.includes('key') &&
        target.includes('userId') &&
        target.includes('endpoint')
      );
    }

    return false;
  }
}
