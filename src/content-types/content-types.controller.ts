import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { ContentTypeService } from './content-types.service';
import { CreateContentTypeDto, UpdateContentTypeDto } from './dto';
import { I18nLang } from 'nestjs-i18n';
@Controller('content-types')
export class ContentTypeController {
  constructor(private readonly contentTypeService: ContentTypeService) {}

  @Post()
  create(@Body() dto: CreateContentTypeDto) {
    return this.contentTypeService.create(dto);
  }

  @Get()
  async getAll(@I18nLang() lang: string) {
    return this.contentTypeService.findAll(lang);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContentTypeDto,
    @I18nLang() lang: string,
  ) {
    return this.contentTypeService.update(id, dto, lang);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contentTypeService.remove(Number(id));
  }
}
