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

@ApiBearerAuth()
@ApiTags('Content-Types')
@Roles(UserType.Admin)
@UseGuards(JwtAuthGuard, AccessGuard, RolesGuard)
@Controller('content-types')
export class ContentTypeController {
  constructor(private readonly contentTypeService: ContentTypeService) {}

  @Get('index')
  async getIndex(@Query('lang') lang = 'hi') {
    return this.contentTypeService.getIndexNavigation(lang);
  }

  @Get(':year/:categorySlug/:contentSlug')
  async getContentByYearSlug(
    @Param('year', ParseIntPipe) year: number,
    @Param('categorySlug') categorySlug: string,
    @Param('contentSlug') contentSlug: string,
    @Query('lang') lang = 'hi',
  ) {
    return this.contentTypeService.getContentByYearSlug(
      year,
      categorySlug,
      contentSlug,
      lang,
    );
  }

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
    @Query('categoryId') categoryId?: number,
    @Query('subcategoryId') subcategoryId?: number,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    return this.contentTypeService.findAll(
      lang,
      categoryId ? Number(categoryId) : undefined,
      subcategoryId ? Number(subcategoryId) : undefined,
      skip ? Number(skip) : 0,
      take ? Number(take) : 10,
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
