import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

type ErrorResponse = {
  statusCode: number;
  error: string;
  message: string;
  path: string;
  timestamp: string;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    const timestamp = new Date().toISOString();
    const path = request?.originalUrl ?? request?.url ?? '';

    const resolved = this.resolveException(exception);

    if (resolved.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled error on ${path}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const payload: ErrorResponse = {
      statusCode: resolved.statusCode,
      error: resolved.error,
      message: resolved.message,
      path,
      timestamp,
    };

    response.status(resolved.statusCode).json(payload);
  }

  private resolveException(exception: unknown): {
    statusCode: number;
    error: string;
    message: string;
  } {
    if (exception instanceof HttpException) {
      return this.resolveHttpException(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolveKnownPrismaError(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: this.statusText(HttpStatus.BAD_REQUEST),
        message: 'Invalid database query',
      };
    }

    if (
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientRustPanicError
    ) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: this.statusText(HttpStatus.INTERNAL_SERVER_ERROR),
        message: 'Internal server error',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: this.statusText(HttpStatus.INTERNAL_SERVER_ERROR),
      message: 'Internal server error',
    };
  }

  private resolveHttpException(exception: HttpException): {
    statusCode: number;
    error: string;
    message: string;
  } {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();
    const fallbackMessage = exception.message || this.statusText(statusCode);

    if (typeof response === 'string') {
      return {
        statusCode,
        error: this.statusText(statusCode),
        message: response,
      };
    }

    if (response && typeof response === 'object') {
      const responseObject = response as Record<string, unknown>;
      const rawError = responseObject.error;
      const rawMessage = responseObject.message;

      return {
        statusCode,
        error:
          typeof rawError === 'string' ? rawError : this.statusText(statusCode),
        message: this.normalizeMessage(rawMessage, fallbackMessage),
      };
    }

    return {
      statusCode,
      error: this.statusText(statusCode),
      message: fallbackMessage,
    };
  }

  private resolveKnownPrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): {
    statusCode: number;
    error: string;
    message: string;
  } {
    if (exception.code === 'P2002') {
      return {
        statusCode: HttpStatus.CONFLICT,
        error: this.statusText(HttpStatus.CONFLICT),
        message: 'Unique constraint violation',
      };
    }

    if (exception.code === 'P2025') {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        error: this.statusText(HttpStatus.NOT_FOUND),
        message: 'Record not found',
      };
    }

    return {
      statusCode: HttpStatus.BAD_REQUEST,
      error: this.statusText(HttpStatus.BAD_REQUEST),
      message: 'Database request failed',
    };
  }

  private normalizeMessage(raw: unknown, fallback: string): string {
    if (typeof raw === 'string' && raw.trim()) {
      return raw;
    }

    if (Array.isArray(raw)) {
      const messages = raw
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);

      if (messages.length > 0) {
        return messages.join(', ');
      }
    }

    return fallback;
  }

  private statusText(statusCode: number): string {
    const value = HttpStatus[statusCode];
    if (typeof value !== 'string') {
      return 'Error';
    }

    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
