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
  BadRequestException,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { I18nLang } from 'nestjs-i18n';
import { SubcategoriesService } from './subcategories.service';
import {
  CreateSubcategoryRequestDto,
  UpdateSubcategoryRequestDto,
} from './dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessGuard, JwtAuthGuard, RolesGuard, Roles } from '@Common';
import { UserType } from '@Common';
import { Response } from 'express';


@ApiBearerAuth()
@ApiTags('Subcategory')
@Roles(UserType.Admin)
@UseGuards(JwtAuthGuard, AccessGuard, RolesGuard)
@Controller('subcategories')
export class SubcategoriesController {
  constructor(private readonly subcategoriesService: SubcategoriesService) { }


  @Post()
  async create(@Body() dto: CreateSubcategoryRequestDto, @I18nLang() lang: string) {
    return this.subcategoriesService.create(dto, lang);
  }


  @Get('category/:categoryId')
  findByCategory(
    @Param('categoryId') categoryId: string,
    @I18nLang() lang: string,
    @Res({ passthrough: true }) res: Response,
    @Query('subcategoryId') subcategoryId?: number,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');

    return this.subcategoriesService.findByCategory(
      Number(categoryId),
      Number(subcategoryId),
      lang,
      skip ? Number(skip) : 0,
      take ? Number(take) : 10,
    );
  }

  @Get('children')
  async getSubcategories(
    @Query('parentId') parentId: string,
    @Query('lang') lang: string = 'hi',
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.subcategoriesService.getChildren(
      Number(parentId || 0),
      lang,
      Number(skip || 0),
      Number(take || 10),
    );
  }

  @Get(':id')
  async getSingleSubcategory(
    @Param('id', ParseIntPipe) id: number,
    @Query('lang') lang: string = 'hi',
  ) {
    return this.subcategoriesService.getSubcategory(id, lang);
  }


  @Get(':id/data')
  async getSubcategoryData(
    @Param('id', ParseIntPipe) id: number,
    @Query('lang') lang: string = 'hi',
  ) {
    return this.subcategoriesService.getSubcategoryData(id, lang);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubcategoryRequestDto,
    @I18nLang() lang: string,
  ) {
    return this.subcategoriesService.update(Number(id), dto, lang);
  }
  @Delete(':id')
  remove(@Param('id') id: string, @I18nLang() lang: string) {
    return this.subcategoriesService.remove(Number(id), lang);
  }
}



