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

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { status, message, error } = this.resolve(exception);

    const body: ErrorBody = {
      statusCode: status,
      message,
      error,
      path: req.url,
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url} → ${status}`, (exception as Error)?.stack);
    }

    res.status(status).json(body);
  }

  private resolve(exception: unknown): { status: number; message: string | string[]; error: string } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resp = exception.getResponse();
      const message =
        typeof resp === 'string'
          ? resp
          : ((resp as { message?: string | string[] }).message ?? exception.message);
      return { status, message, error: HttpStatus[status] ?? 'Error' };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrisma(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'InternalServerError',
    };
  }

  private mapPrisma(e: Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: `Unique constraint failed on ${(e.meta?.target as string[])?.join(', ') ?? 'field'}`,
          error: 'Conflict',
        };
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, message: 'Resource not found', error: 'NotFound' };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Foreign key constraint failed',
          error: 'BadRequest',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error',
          error: 'DatabaseError',
        };
    }
  }
}
