import {
  Controller,
  Delete,
  Patch,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FileService } from './file.service';
import { ApiTags } from '@nestjs/swagger';
import { FileType } from '@prisma/client';
import {
  AccessGuard,
  JwtAuthGuard,
  PaginatedDto,
  Roles,
  RolesGuard,
  UserType,
} from '@Common';
import { I18nLang } from 'nestjs-i18n';
import { UpdateFileRequestDto } from './dto';

@ApiTags('Files')
@Roles(UserType.Admin)
@UseGuards(JwtAuthGuard, AccessGuard, RolesGuard)
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get('content-types/:id')
  async getFilesByContentType(
    @Param('id', ParseIntPipe) id: number,
    @I18nLang() lang: string,
  ) {
    return this.fileService.getFilesByContentType(id, lang);
  }
  @Get()
  getAll(
    @Query('contentTypeId') contentTypeId?: number,
    @Query('type') type?: FileType,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('lang') lang = 'hi',
  ) {
    return this.fileService.getAllFiles({
      contentTypeId: contentTypeId ? Number(contentTypeId) : undefined,
      type,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 20,
      lang,
    });
  }

  @Get('category/:id')
  getByCategory(
    @Param('id', ParseIntPipe) id: number,
    @Query('lang') queryLang: string,
    @I18nLang() i18nLang: string,
    @Query() pagination: PaginatedDto,
    @Query('type') type?: FileType,
  ) {
    const lang = queryLang ?? i18nLang ?? 'hi';

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
    @Query('lang') queryLang: string,
    @I18nLang() i18nLang: string,
    @Query() pagination: PaginatedDto,
    @Query('type') type?: FileType,
  ) {
    const lang = queryLang ?? i18nLang ?? 'hi';

    return this.fileService.getFilesBySubcategory(id, {
      skip: pagination.skip,
      take: pagination.take,
      type,
      lang,
    });
  }

  @Patch(':id')
  updateFile(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFileRequestDto,
  ) {
    return this.fileService.update(id, dto);
  }

  @Delete(':id')
  async deleteFile(@Param('id', ParseIntPipe) id: number) {
    return this.fileService.deleteFile(id);
  }
}
