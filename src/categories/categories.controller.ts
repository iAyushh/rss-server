import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CategoryService } from './categories.service';
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
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  create(@Body() dto: CreateCategoryRequestDto, @I18nLang() lang: string) {
    return this.categoryService.create(dto, lang);
  }

  @Get()
  findAll(@I18nLang() lang: string) {
    return this.categoryService.findAll(lang);
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
