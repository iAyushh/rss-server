import {
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IngestionService } from './ingestion.service';
import { IngestionDto } from './dto';
import { StorageFilesInterceptor } from 'src/common/interceptors';
import {
  AccessGuard,
  JwtAuthGuard,
  Roles,
  RolesGuard,
  UserType,
} from '@Common';

@ApiTags('Ingestion')
@Roles(UserType.Admin)
@UseGuards(JwtAuthGuard, AccessGuard, RolesGuard)
@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['contentTypeId', 'contentYear', 'type', 'files'],
      properties: {
        contentTypeId: { type: 'number', example: 12 },
        contentYear: { type: 'number', example: 2024 },
        type: {
          type: 'string',
          enum: [
            'IMAGE',
            'PDF',
            'WORD',
            'TEXT',
            'CSV',
            'EXCEL',
            'AUDIO',
            'VIDEO',
            'OTHER',
          ],
        },
        metadata: {
          type: 'string',
          example: '{"category":"Documents","subcategory":"Reports"}',
        },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @UseInterceptors(StorageFilesInterceptor)
  ingest(
    @Body() dto: IngestionDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.ingestionService.ingest(dto, files);
  }
}
