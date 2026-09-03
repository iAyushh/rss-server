import {
  Controller,
  ParseFilePipeBuilder,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiBody, ApiTags, ApiOperation } from '@nestjs/swagger';
import { StorageService, File, JwtAuthGuard, AccessGuard } from '@Common';

@Controller()
export class AppController {
  constructor(private readonly storageService: StorageService) { }

  @ApiTags('Storage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk upload files ' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @UseGuards(JwtAuthGuard, AccessGuard)
  @UseInterceptors(FilesInterceptor('files', 20))
  @Post('upload')
  upload(
    @UploadedFiles(new ParseFilePipeBuilder().build({
      fileIsRequired: true,
    }))
    files: Array<File>,
  ) {
    return files.map((file) => ({
      url: this.storageService.getFileUrl(file.filename),
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
    }));
  }
}
