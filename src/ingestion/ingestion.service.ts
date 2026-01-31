import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';
import { IngestionDto } from './dto';
import { FILE_TYPE_MIME_MAP } from 'src/common/constants/file-type-mime.map';
import { FileType } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { NormalizedFileInput } from 'src/file/types';

@Injectable()
export class IngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  private validateFiles(files: Express.Multer.File[], type: FileType) {
    const allowedMimes = FILE_TYPE_MIME_MAP[type];
    if (!allowedMimes?.length) return;

    for (const file of files) {
      if (!allowedMimes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file "${file.originalname}". Expected ${type} file.`,
        );
      }
    }
  }

  private generateStorageKey(ext: string) {
    return `${randomUUID().replace(/-/g, '')}${ext}`;
  }

  async ingest(dto: IngestionDto, files: Express.Multer.File[]) {
    const contentType = await this.prisma.contentType.findUnique({
      where: { id: dto.contentTypeId },
    });

    if (!contentType) {
      throw new BadRequestException('Invalid contentTypeId');
    }

    this.validateFiles(files, dto.type);

    let parsedMetadata: Record<string, string> = {};
    if (dto.metadata) {
      try {
        parsedMetadata = JSON.parse(dto.metadata);
      } catch {
        throw new BadRequestException('Invalid metadata JSON');
      }
    }

    const normalizedFiles: NormalizedFileInput[] = [];

    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const storageKey = this.generateStorageKey(ext);

      // disk write FIRST
      await fs.writeFile(
        path.join(process.cwd(), 'uploads', storageKey),
        file.buffer,
      );

      normalizedFiles.push({
        displayName: dto.displayName ?? file.originalname,
        description: dto.description,
        originalName: file.originalname,
        storageKey,
        mimeType: file.mimetype,
        extension: ext,
        fileSize: file.size,
        fileType: dto.type,
      });
    }

    try {
      const assets = await this.prisma.$transaction(async (tx) => {
        return this.fileService.attachFiles(
          tx,
          dto.contentTypeId,
          normalizedFiles,
          parsedMetadata,
        );
      });

      return {
        success: true,
        contentTypeId: dto.contentTypeId,
        files: assets.map((f) => ({
          id: f.id,
          displayName: f.displayName,
          originalName: f.originalName,
          description: f.description,
          fileSize: f.fileSize,
          fileType: f.fileType,
          url: this.fileService.getPublicUrl(f.storageKey),
          uploadedAt: f.uploadedAt,
        })),
      };
    } catch (err) {
      // 🔥 CLEANUP ON FAILURE
      await Promise.all(
        normalizedFiles.map((f) =>
          fs
            .unlink(path.join(process.cwd(), 'uploads', f.storageKey))
            .catch(() => {}),
        ),
      );
      throw err;
    }
  }
}
