import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { PrismaService } from 'src/prisma';

@Module({
  providers: [SearchService, PrismaService],
  controllers: [SearchController],
})
export class SearchModule {}
