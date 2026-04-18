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
  Res,
} from '@nestjs/common';
import { CategoryService } from './categories.service';
import { CreateCategoryRequestDto, UpdateCategoryRequestDto } from './dto';
import { I18nLang } from 'nestjs-i18n';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessGuard, JwtAuthGuard, RolesGuard, Roles } from '@Common';
import { UserType } from '@Common';
import { Response } from 'express';

@ApiBearerAuth()
@ApiTags('Category')
@Roles(UserType.Admin)
@UseGuards(JwtAuthGuard, AccessGuard, RolesGuard)
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  create(@Body() dto: CreateCategoryRequestDto, @I18nLang() lang: string) {
    return this.categoryService.create(dto, lang);
  }

  @Get()
  findAll(
    @I18nLang() lang: string,
    @Res({ passthrough: true }) res: Response,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');

    return this.categoryService.findAll(
      lang,
      skip ? Number(skip) : 0,
      take ? Number(take) : 20,
    );
  }

  @Get(':categoryId/combined')
  async getCategoryCombined(
    @Param('categoryId') categoryId: number,
    @Res({ passthrough: true }) res: Response,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('lang') lang?: string,
    @I18nLang() i18nLang?: string,
  ) {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    return this.categoryService.getCategoryCombined({
      categoryId: Number(categoryId),
      skip: Number(skip) || 0,
      take: Number(take) || 20,
      lang: lang ?? i18nLang ?? 'hi',
    });
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
