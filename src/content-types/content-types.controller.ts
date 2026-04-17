import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Param,
  Patch,
  Delete,
  UseGuards,
  Query,
  Res,
} from '@nestjs/common';
import { ContentTypeService } from './content-types.service';
import { CreateContentTypeDto, UpdateContentTypeDto } from './dto';
import { I18nLang } from 'nestjs-i18n';
import {
  AccessGuard,
  JwtAuthGuard,
  Roles,
  RolesGuard,
  UserType,
} from '@Common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

@ApiBearerAuth()
@ApiTags('Content-Types')
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('content-types')
export class ContentTypeController {
  constructor(private readonly contentTypeService: ContentTypeService) { }

  @Post()
  create(@Body() dto: CreateContentTypeDto) {
    return this.contentTypeService.create(dto);
  }

  @Get()
  @ApiQuery({ name: 'categoryId', required: false, type: Number })
  @ApiQuery({ name: 'subcategoryId', required: false, type: Number })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  async getAll(
    @I18nLang() lang: string,
    @Res({ passthrough: true }) res: Response,
    @Query('categoryId') categoryId?: number,
    @Query('subcategoryId') subcategoryId?: number,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');

    return this.contentTypeService.findAll(
      lang,
      categoryId ? Number(categoryId) : undefined,
      subcategoryId ? Number(subcategoryId) : undefined,
      skip ? Number(skip) : 0,
      take ? Number(take) : 10,
    );
  }

  @Get('index')
  async getIndex(
    @Query('lang') lang = 'en',
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600');

    return this.contentTypeService.getIndexNavigation(lang);
  }

  @Get(':year/:categorySlug/:contentSlug')
  async getContentByYearSlug(
    @Param('year', ParseIntPipe) year: number,
    @Param('categorySlug') categorySlug: string,
    @Param('contentSlug') contentSlug: string,
    @Query('lang') lang = 'hi',
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600');

    return this.contentTypeService.getContentByYearSlug(
      year,
      categorySlug,
      contentSlug,
      lang,
    );
  }

  
  @Roles(UserType.Admin)
  @UseGuards(JwtAuthGuard, AccessGuard, RolesGuard)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContentTypeDto,
    @I18nLang() lang: string,
  ) {
    return this.contentTypeService.update(id, dto, lang);
  }

  @Roles(UserType.Admin)
  @UseGuards(JwtAuthGuard, AccessGuard, RolesGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contentTypeService.remove(Number(id));
  }
}
