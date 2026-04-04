import { extname } from 'node:path';
import { memoryStorage } from 'multer';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { storageConfigFactory } from '@Config';

@Injectable()
export class StorageService {
  defaultMulterOptions: MulterOptions;

  constructor(
    @Inject(storageConfigFactory.KEY)
    private readonly config: ConfigType<typeof storageConfigFactory>,
  ) {
    this.defaultMulterOptions = {

      storage: memoryStorage(),


      limits: {
        fileSize: this.config.maxFileSize,
      },


      fileFilter: (req, file, cb) => {
        const extension = extname(file.originalname).toLowerCase();

        if (this.config.allowedExtensions.includes(extension)) {
          cb(null, true);
        } else {
          cb(
            new Error(
              `Unsupported file type. Allowed: ${this.config.allowedExtensions.join(', ')}`,
            ),
            false,
          );
        }
      },
    };
  }
}