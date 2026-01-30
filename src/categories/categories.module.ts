import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma';
import { CategoryController } from './categories.controller';
import { CategoryService } from './categories.service';
@Module({
  imports: [PrismaModule],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoriesModule {}
