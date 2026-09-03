import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { CategoryService } from './categories.service';
import { FileService } from '../file/file.service';
import { CreateCategoryRequestDto, UpdateCategoryRequestDto } from './dto';
import { I18nLang } from 'nestjs-i18n';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessGuard, JwtAuthGuard, RolesGuard, Roles } from '@Common';
import { UserType } from '@Common';

@ApiBearerAuth()
@ApiTags('Category')
@Roles(UserType.Admin)
@UseGuards(JwtAuthGuard, AccessGuard, RolesGuard)
@Controller('categories')
export class CategoryController {
  constructor(
    private readonly categoryService: CategoryService,
    private readonly fileService: FileService,
  ) { }

  @Post()
  create(@Body() dto: CreateCategoryRequestDto, @I18nLang() lang: string) {
    return this.categoryService.create(dto, lang);
  }

  @Get()
  findAll(
    @I18nLang() lang: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    return this.categoryService.findAll(
      lang,
      skip ? Number(skip) : 0,
      take ? Number(take) : 20,
    );
  }

  @Get('children/:parentId')
  getChildren(
    @Param('parentId', ParseIntPipe) parentId: number,
    @I18nLang() lang: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    return this.categoryService.getChildren(
      parentId,
      lang,
      skip ? Number(skip) : 0,
      take ? Number(take) : 20,
    );
  }

  @Get('explorer/:parentId')
  async getExplorer(
    @Param('parentId', ParseIntPipe) parentId: number,
    @I18nLang() lang: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    const skipNum = skip ? Number(skip) : 0;
    const takeNum = take ? Number(take) : 50;

    // Execute both independent modules perfectly in parallel avoiding blockages
    const [folders, files] = await Promise.all([
      this.categoryService.getChildren(parentId, lang, skipNum, takeNum),
      this.fileService.getFilesByCategory(parentId, { lang, skip: skipNum, take: takeNum })
    ]);

    return {
      subFolders: folders.data,
      totalFolders: folders.total,
      files: files.files,
      totalFiles: files.total
    };
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryRequestDto,
    @I18nLang() lang: string,
  ) {
    return this.categoryService.update(Number(id), dto, lang);
  }
  @Delete(':id')
  remove(@Param('id') id: string, @I18nLang() lang: string) {
    return this.categoryService.remove(Number(id), lang);
  }
}
