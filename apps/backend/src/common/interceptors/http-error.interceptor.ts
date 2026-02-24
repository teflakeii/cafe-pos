import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

type ErrorPayload = {
  timestamp: string;
  path: string;
  statusCode: number;
  message: string;
};

@Injectable()
export class HttpErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpErrorInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request?.originalUrl ?? request?.url ?? '';
    const method = request?.method ?? 'UNKNOWN';

    return next.handle().pipe(
      catchError((error: unknown) => {
        const resolved = this.resolveException(error);

        const payload: ErrorPayload = {
          timestamp: new Date().toISOString(),
          path,
          statusCode: resolved.statusCode,
          message: resolved.message,
        };

        const logEntry = JSON.stringify({
          level: resolved.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR ? 'error' : 'warn',
          context: HttpErrorInterceptor.name,
          userId: null,
          action: 'HTTP_ERROR',
          metadata: {
            method,
            path,
            statusCode: resolved.statusCode,
            message: resolved.message,
          },
        });

        if (resolved.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
          this.logger.error(
            logEntry,
            process.env.NODE_ENV === 'production'
              ? undefined
              : error instanceof Error
                ? error.stack
                : String(error),
          );
        } else {
          this.logger.warn(logEntry);
        }

        return throwError(() => new HttpException(payload, resolved.statusCode));
      }),
    );
  }

  private resolveException(error: unknown): {
    statusCode: number;
    message: string;
  } {
    if (error instanceof HttpException) {
      const statusCode = error.getStatus();
      const response = error.getResponse();
      const fallbackMessage =
        statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal server error'
          : error.message || 'Request failed';

      if (typeof response === 'string') {
        return {
          statusCode,
          message: this.sanitizeMessage(response, statusCode, fallbackMessage),
        };
      }

      if (response && typeof response === 'object') {
        const responseObject = response as Record<string, unknown>;

        return {
          statusCode,
          message: this.normalizeHttpMessage(
            responseObject.message,
            statusCode,
            fallbackMessage,
          ),
        };
      }

      return {
        statusCode,
        message: fallbackMessage,
      };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Unique constraint violation',
        };
      }

      if (error.code === 'P2025') {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
        };
      }

      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Database request failed',
      };
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid database query',
      };
    }

    if (
      error instanceof Prisma.PrismaClientInitializationError ||
      error instanceof Prisma.PrismaClientRustPanicError ||
      error instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private normalizeHttpMessage(
    rawMessage: unknown,
    statusCode: number,
    fallback: string,
  ): string {
    if (typeof rawMessage === 'string') {
      return this.sanitizeMessage(rawMessage, statusCode, fallback);
    }

    if (Array.isArray(rawMessage)) {
      const message = rawMessage
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
        .join(', ');

      return this.sanitizeMessage(message, statusCode, fallback);
    }

    return fallback;
  }

  private sanitizeMessage(
    message: string,
    statusCode: number,
    fallback: string,
  ): string {
    const normalized = message.trim();
    if (!normalized) {
      return fallback;
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : normalized;
    }

    return normalized;
  }
}
