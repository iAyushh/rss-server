import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchablePaginatedDto } from '@Common';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async globalSearch(@Query() dto: SearchablePaginatedDto) {
    return this.searchService.globalSearch(
      dto.search ?? '',
      dto.languageCode ?? 'en',
      dto.skip ?? 0,
      dto.take ?? 20,
      dto.year,
    );
  }
}
