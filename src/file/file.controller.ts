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
import { FileType } from '@prisma/client';
import { PaginatedDto } from '@Common';

@ApiTags('Files')
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get('content-types/:id')
  async getFilesByContentType(@Param('id', ParseIntPipe) id: number) {
    return this.fileService.getFilesByContentType(id);
  }
  @Get()
  getAll(
    @Query() pagination: PaginatedDto,
    @Query('contentTypeId') contentTypeId?: number,
    @Query('type') type?: FileType,
  ) {
    return this.fileService.getAllFiles({
      contentTypeId,
      type,
      skip: pagination.skip ?? 0,
      take: pagination.take ?? 20,
    });
  }

  @Delete(':id')
  async deleteFile(@Param('id', ParseIntPipe) id: number) {
    return this.fileService.deleteFile(id);
  }
}
