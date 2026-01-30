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
import { I18nLang } from 'nestjs-i18n';

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

  @Get('category/:id')
  getByCategory(
    @Param('id', ParseIntPipe) id: number,
    @I18nLang() lang: string,
    @Query() pagination: PaginatedDto,
    @Query('type') type?: FileType,
  ) {
    return this.fileService.getFilesByCategory(id, {
      skip: pagination.skip,
      take: pagination.take,
      type,
      lang,
    });
  }

  @Get('subcategory/:id')
  getBySubcategory(
    @Param('id', ParseIntPipe) id: number,
    @I18nLang() lang: string,
    @Query() pagination: PaginatedDto,
    @Query('type') type?: FileType,
  ) {
    return this.fileService.getFilesBySubcategory(id, {
      skip: pagination.skip,
      take: pagination.take,
      type,
      lang,
    });
  }

  @Delete(':id')
  async deleteFile(@Param('id', ParseIntPipe) id: number) {
    return this.fileService.deleteFile(id);
  }
}
