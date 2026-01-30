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
import { I18nLang } from 'nestjs-i18n';
import { SubcategoriesService } from './subcategories.service';
import {
  CreateSubcategoryRequestDto,
  UpdateSubcategoryRequestDto,
} from './dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessGuard, JwtAuthGuard, RolesGuard, Roles } from '@Common';
import { UserType } from '@Common';

@ApiBearerAuth()
@ApiTags('Subcategory')
@Roles(UserType.Admin)
@UseGuards(JwtAuthGuard, AccessGuard, RolesGuard)
@Controller('subcategories')
export class SubcategoriesController {
  constructor(private readonly subcategoriesService: SubcategoriesService) {}

  @Post()
  create(@Body() dto: CreateSubcategoryRequestDto, @I18nLang() lang: string) {
    return this.subcategoriesService.create(dto, lang);
  }

  @Get('category/:categoryId')
  findByCategory(
    @Param('categoryId') categoryId: string,
    @I18nLang() lang: string,
  ) {
    return this.subcategoriesService.findByCategory(Number(categoryId), lang);
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
