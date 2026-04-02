import { isAxiosError } from 'axios';
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { MulterError } from 'multer';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const hostType = host.getType();
    if (hostType !== 'http') return;

    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

   
    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const res = exception.getResponse();

      message =
        typeof res === 'string'
          ? res
          : (res as any).message || exception.message;
    }

    
    else if (exception instanceof MulterError) {
      httpStatus = HttpStatus.BAD_REQUEST;

      if (exception.code === 'LIMIT_FILE_SIZE') {
        message = 'File too large. Max allowed size is 100MB';
      } else {
        message = exception.message;
      }
    }

    
    else if (isAxiosError(exception)) {
      const status = exception.response?.status;

      if (status === 413) {
        httpStatus = HttpStatus.BAD_REQUEST;
        message = 'File too large. Max allowed size is 100MB';
      } else {
        httpStatus = status || HttpStatus.BAD_REQUEST;
        message =
          exception.response?.data?.error?.message ||
          exception.response?.data?.message ||
          exception.message ||
          'Upload failed';
      }
    }

   
    else if (exception instanceof Error) {
      httpStatus = HttpStatus.BAD_REQUEST;
      message = exception.message;
    }

    const responseBody = {
      statusCode: httpStatus,
      message,
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}