import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma';
import { CategoryController } from './categories.controller';
import { CategoryService } from './categories.service';
import { FileModule } from '../file/file.module';

@Module({
  imports: [PrismaModule, FileModule],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoriesModule { }
