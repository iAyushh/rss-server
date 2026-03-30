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
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
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

@ApiBearerAuth()
@ApiTags('Files')
@Roles(UserType.Admin)
@UseGuards(JwtAuthGuard, AccessGuard, RolesGuard)
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) { }

  @Get()
  @ApiQuery({ name: 'contentTypeId', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, enum: FileType })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['updatedAt', 'fileSize', 'originalName'],
  })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'lang', required: false, type: String })
  async getAllFiles(
    @Query('contentTypeId') contentTypeId?: number,
    @Query('type') type?: FileType,
    @Query('sortBy') sortBy?: 'updatedAt' | 'fileSize' | 'originalName',
    @Query('order') order?: 'asc' | 'desc',
    @Query() pagination?: PaginatedDto,
    @Query('lang') queryLang?: string,
    @I18nLang() i18nLang?: string,
  ) {
    const lang = queryLang ?? i18nLang ?? 'hi';

    return this.fileService.getAllFiles({
      contentTypeId: contentTypeId ? Number(contentTypeId) : undefined,
      type,
      sortBy,
      order,
      skip: pagination?.skip,
      take: pagination?.take,
      lang,
    });
  }



  @Get('index')
  @ApiQuery({
    name: 'groupBy',
    required: true,
    enum: ['year', 'contentType', 'category'],
  })
  @ApiQuery({ name: 'lang', required: false, type: String })
  async getFileIndex(
    @Query('groupBy') groupBy: 'year' | 'contentType' | 'category',
    @Query('lang') queryLang?: string,
    @I18nLang() i18nLang?: string,
  ) {
    const lang = queryLang ?? i18nLang ?? 'hi';

    return this.fileService.getFileIndex(groupBy, lang);
  }

  @Get('content-types/:id')
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, enum: FileType })
  @ApiQuery({ name: 'lang', required: false, type: String })
  getFilesByContentType(
    @Param('id', ParseIntPipe) id: number,
    @Query() pagination: PaginatedDto,
    @Query('type') type?: FileType,
    @Query('lang') queryLang?: string,
    @I18nLang() i18nLang?: string,
  ) {
    const lang = queryLang ?? i18nLang ?? 'hi';

    return this.fileService.getFilesByContentType(id, {
      skip: pagination.skip,
      take: pagination.take,
      type,
      lang,
    });
  }

  @Get('category/:id')
  @ApiQuery({ name: 'type', required: false, enum: FileType })
  @ApiQuery({ name: 'lang', required: false, type: String })
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
  @ApiQuery({ name: 'type', required: false, enum: FileType })
  @ApiQuery({ name: 'lang', required: false, type: String })
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
  @Get('list/content-types')
  @ApiQuery({ name: 'lang', required: false, type: String })
  getAllContentTypes(
    @Query('lang') queryLang?: string,
    @I18nLang() i18nLang?: string,
  ) {
    const lang = queryLang ?? i18nLang ?? 'hi';
    return this.fileService.getAllContentTypes(lang);
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
