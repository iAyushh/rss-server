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

  @Get('children')
  async getSubcategories(
    @Query('parentId') parentId: string,
    @Query('lang') lang: string = 'hi',
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const parsedParentId = Number(parentId);
    const parsedSkip = Number(skip || 0);
    const parsedTake = Number(take || 10);

    if (isNaN(parsedParentId)) {
      throw new BadRequestException('Invalid parentId');
    }

    return this.subcategoriesService.getChildren(
      parsedParentId,
      lang,
      parsedSkip,
      parsedTake,
    );
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
