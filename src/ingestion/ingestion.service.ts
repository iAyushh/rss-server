import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';
import { IngestionDto } from './dto';
import { FILE_TYPE_MIME_MAP } from '../common/constants/file-type-mime.map';
import { FileType } from '@prisma/client';
import * as path from 'node:path';

@Injectable()
export class IngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  //  MIME validation
  private validateFiles(files: Express.Multer.File[], type: FileType) {
    const allowedMimes = FILE_TYPE_MIME_MAP[type];
    if (!allowedMimes?.length) return;

    for (const file of files) {
      if (!allowedMimes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file "${file.originalname}" for type ${type}`,
        );
      }
    }
  }

  async ingest(dto: IngestionDto, files: Express.Multer.File[]) {
    const contentType = await this.prisma.contentType.findUnique({
      where: { id: dto.contentTypeId },
    });

    if (!contentType) {
      throw new BadRequestException('Invalid contentTypeId');
    }

    this.validateFiles(files, dto.type);

    const normalizedFiles = files.map((file) => ({
      originalName: file.originalname,
      storageKey: file.filename,
      mimeType: file.mimetype,
      extension: path.extname(file.originalname),
      fileSize: file.size,
      fileType: dto.type,
      displayName: dto.displayName ?? file.originalname,
      description: dto.description ?? null,
    }));

    const assets = await this.prisma.$transaction(async (tx) => {
      const lang = dto.lang ?? 'hi';

      let categoryName: string | undefined;
      let subcategoryName: string | undefined;

      if (dto.categoryId) {
        const categoryTranslation =
          (await tx.categoryTranslation.findFirst({
            where: {
              categoryId: dto.categoryId,
              languageCode: lang,
            },
          })) ??
          (await tx.categoryTranslation.findFirst({
            where: {
              categoryId: dto.categoryId,
              languageCode: 'hi',
            },
          }));
        categoryName = categoryTranslation?.name;
      }

      if (dto.subcategoryId) {
        const subcategoryTranslation =
          (await tx.subcategoryTranslation.findFirst({
            where: {
              subcategoryId: dto.subcategoryId,
              languageCode: lang,
            },
          })) ??
          (await tx.subcategoryTranslation.findFirst({
            where: {
              subcategoryId: dto.subcategoryId,
              languageCode: 'hi',
            },
          }));

        subcategoryName = subcategoryTranslation?.name;
      }
      const createdAssets = [];

      for (const file of normalizedFiles) {
        const asset = await tx.fileAsset.create({
          data: {
            contentTypeId: dto.contentTypeId,
            originalName: file.originalName,
            storageKey: file.storageKey,
            mimeType: file.mimeType,
            extension: file.extension,
            fileSize: file.fileSize,
            fileType: file.fileType,
          },
        });

        await tx.fileTranslation.create({
          data: {
            fileId: asset.id,
            languageCode: lang,
            displayName: file.displayName,
            description: file.description,
          },
        });

        const metadataRows: { key: string; value: string }[] = [];

        if (categoryName) {
          metadataRows.push({
            key: 'category',
            value: categoryName,
          });
        }

        if (subcategoryName) {
          metadataRows.push({
            key: 'subcategory',
            value: subcategoryName,
          });
        }

        if (metadataRows.length > 0) {
          await tx.fileMetadata.createMany({
            data: metadataRows.map((m) => ({
              fileId: asset.id,
              key: m.key,
              value: m.value,
            })),
          });
        }

        createdAssets.push(asset);
      }

      return createdAssets;
    });

    return {
      success: true,
      files: assets.map((file) => ({
        id: file.id,
        fileType: file.fileType,
        fileSize: file.fileSize,
        url: this.fileService.getPublicUrl(file.storageKey),
        uploadedAt: file.uploadedAt,
      })),
    };
  }
}
