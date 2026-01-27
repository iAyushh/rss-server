import {
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IngestionService } from './ingestion.service';
import { IngestionDto } from './dto/ingestion.dto';
import { StorageFilesInterceptor } from 'src/common/interceptors';

@ApiTags('Ingestion')
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
          enum: ['IMAGE', 'PDF', 'WORD', 'TEXT', 'CSV', 'EXCEL', 'OTHER'],
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
