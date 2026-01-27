import { Module } from '@nestjs/common';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FileModule } from 'src/file/file.module';

@Module({
  imports: [PrismaModule, FileModule],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class IngestionModule {}
