import {
  Controller,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiBody, ApiTags } from '@nestjs/swagger';
import { StorageService, File, JwtAuthGuard, AccessGuard } from '@Common';
import { storage } from './configs/cloudinary.storage';

@Controller()
export class AppController {

  @ApiTags('Storage')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseGuards(JwtAuthGuard, AccessGuard)
  @UseInterceptors(FileInterceptor('file', { storage }))
  @Post('upload')
  upload(
    @UploadedFile(new ParseFilePipeBuilder().build())
    file: File,
  ) {
    return {
      url: file.path,

      assetPayload: {
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        storageKey: file.filename,
      },

      meta: {
        originalname: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
      },
    };
  }
}
