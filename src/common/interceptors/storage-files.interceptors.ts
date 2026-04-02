import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Observable } from 'rxjs';
import { storage } from 'src/configs/cloudinary.storage';

@Injectable()
export class StorageFilesInterceptor implements NestInterceptor {
  private readonly filesInterceptor: NestInterceptor;

  constructor() {
  const InterceptorClass = FilesInterceptor('files', 10, { storage });
  this.filesInterceptor = new InterceptorClass();
}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> | Promise<Observable<any>> {
    return this.filesInterceptor.intercept(context, next);
  }
}
