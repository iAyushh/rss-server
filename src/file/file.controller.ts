import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { FileService } from './file.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Files')
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get('content-types/:id')
  async getFilesByContentType(@Param('id', ParseIntPipe) id: number) {
    return this.fileService.getFilesByContentType(id);
  }
  @Get()
  getAll(@Query('contentTypeId') contentTypeId?: string) {
    return this.fileService.getAllFiles(
      contentTypeId ? Number(contentTypeId) : undefined,
    );
  }

  @Delete(':id')
  async deleteFile(@Param('id', ParseIntPipe) id: number) {
    return this.fileService.deleteFile(id);
  }
}
