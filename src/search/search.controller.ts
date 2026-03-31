import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchablePaginatedDto } from '@Common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AppCacheInterceptor } from 'src/app-cache.interceptor';

@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) { }


  @UseInterceptors(AppCacheInterceptor)
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

  @UseInterceptors(AppCacheInterceptor)
  @Get('files')
  async searchFiles(@Query() dto: SearchablePaginatedDto) {
    const skip = Number(dto.skip ?? 0);
    const take = Number(dto.take ?? 20);

    return this.searchService.searchFiles(
      dto.search ?? '',
      dto.languageCode ?? 'hi',
      skip,
      take,
      dto.year ? Number(dto.year) : undefined,
    );
  }
}
