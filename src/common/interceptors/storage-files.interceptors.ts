import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Observable } from 'rxjs';
import { StorageService } from 'src/common/providers/storage.service';

@Injectable()
export class StorageFilesInterceptor implements NestInterceptor {
  private readonly filesInterceptor: NestInterceptor;

  constructor(private readonly storageService: StorageService) {
    const InterceptorClass = FilesInterceptor(
      'files',
      10,
      this.storageService.defaultMulterOptions,
    );
    this.filesInterceptor = new InterceptorClass();
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> | Promise<Observable<any>> {
    return this.filesInterceptor.intercept(context, next);
  }
}
