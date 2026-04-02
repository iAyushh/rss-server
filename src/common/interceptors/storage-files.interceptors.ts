import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Observable } from 'rxjs';
import * as multer from 'multer';
import { MulterError } from 'multer';

@Injectable()
export class StorageFilesInterceptor implements NestInterceptor {
  private readonly filesInterceptor: NestInterceptor;

  constructor() {
    const InterceptorClass = FilesInterceptor('files', 10, {
      storage: multer.memoryStorage(), 

      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
    });

    this.filesInterceptor = new InterceptorClass();
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    try {
      return await this.filesInterceptor.intercept(context, next);
    } catch (error) {
      if (error instanceof MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          throw new BadRequestException(
            'File too large. Max allowed size is 100MB',
          );
        }
      }
      throw error;
    }
  }
}