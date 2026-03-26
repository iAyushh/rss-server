import { Controller, Get, Param, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchablePaginatedDto } from '@Common';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) { }

  @Get()
  async globalSearch(@Query() dto: SearchablePaginatedDto) {
    const skip = Number(dto.skip ?? 0);
    const take = Number(dto.take ?? 20);
    const extractedYear =
      dto.year ??
      (dto.search && /^\d{4}$/.test(dto.search)
        ? Number(dto.search)
        : undefined);
    return this.searchService.globalSearch(
      dto.search ?? '',
      dto.languageCode ?? 'en',
      skip,
      take,
      extractedYear,
    );
  }

  @Get('files')
  async searchFiles(@Query() dto: SearchablePaginatedDto) {
    const skip = Number(dto.skip ?? 0);
    const take = Number(dto.take ?? 20);

    return this.searchService.searchFiles(
      dto.search ?? '',
      dto.languageCode ?? 'en',
      skip,
      take,
      dto.year ? Number(dto.year) : undefined,
    );
  }
}
