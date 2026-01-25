import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma';
import { ContentTypeController } from './content-types.controller';
import { ContentTypeService } from './content-types.service';

@Module({
  imports: [PrismaModule],
  controllers: [ContentTypeController],
  providers: [ContentTypeService],
  exports: [ContentTypeService],
})
export class ContentTypesModule {}
