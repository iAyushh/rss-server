import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { MulterError } from 'multer';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) { }



  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') return;

    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();


    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof PayloadTooLargeException) {
      return response.status(400).json({
        statusCode: 400,
        message: 'File too large. Max allowed size is 100MB',
      });
    }


    if (exception instanceof MulterError) {
      if (exception.code === 'LIMIT_FILE_SIZE') {
        return response.status(400).json({
          statusCode: 400,
          message: 'File too large. Max allowed size is 100MB',
        });
      }
    }

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message =
        typeof res === 'string'
          ? res
          : (res as any)?.message || exception.message;
    } else if (exception instanceof Error) {

      status = HttpStatus.BAD_REQUEST;
      message = exception.message;
    }

    httpAdapter.reply(
      ctx.getResponse(),
      {
        statusCode: status,
        message,
      },
      status,
    );
  }
}