import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';
import { IngestionDto } from './dto/ingestion.dto';
import { FILE_TYPE_MIME_MAP } from 'src/common/constants/file-type-mime.map';
import { FileType } from '@prisma/client';

@Injectable()
export class IngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}
  private validateFiles(files: Express.Multer.File[], type: FileType) {
    const allowedMimes = FILE_TYPE_MIME_MAP[type];

    if (!allowedMimes || allowedMimes.length === 0) {
      return;
    }

    for (const file of files) {
      if (!allowedMimes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file "${file.originalname}". Expected ${type} file.`,
        );
      }
    }
  }

  async ingest(dto: IngestionDto, files: Express.Multer.File[]) {
    const content = await this.prisma.contentType.findUnique({
      where: { id: dto.contentTypeId },
    });

    if (!content) {
      throw new Error('Content type not found');
    }

    this.validateFiles(files, dto.type);
    const parsedMetadata = dto.metadata ? JSON.parse(dto.metadata) : {};
    const assets = await this.fileService.attachFiles(
      this.prisma,
      dto.contentTypeId,
      files,
      dto.type,
      parsedMetadata,
    );

    return {
      success: true,
      contentTypeId: dto.contentTypeId,
      type: dto.type,
      metadata: parsedMetadata,
      files: assets.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        fileType: file.fileType,
        url: this.fileService.getPublicUrl(file.storageKey),
        uploadedAt: file.uploadedAt,
      })),
    };
  }
}
