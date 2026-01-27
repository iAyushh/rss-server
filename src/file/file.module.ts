import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FileController } from './file.controller';

@Module({
  imports: [PrismaModule],
  controllers: [FileController],
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}
