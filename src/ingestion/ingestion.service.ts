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

  // MIME validation
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
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    let metadata: any = {};
    if (dto.metadata) {
      try {
        metadata = JSON.parse(dto.metadata);
      } catch {
        throw new BadRequestException('Invalid metadata JSON');
      }
    }

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
      displayName: dto.displayName || file.originalname,
      description: dto.description ?? null,
    }));

    const assets = await this.prisma.$transaction(
      async (tx) => {
        const lang = dto.lang ?? 'hi';

        let categorySlug: string | undefined;
        let subcategorySlug: string | undefined;

        if (dto.categoryId) {
          const category = await tx.category.findUnique({
            where: { id: dto.categoryId },
            select: { slug: true },
          });
          categorySlug = category?.slug;
        }

        if (dto.subcategoryId) {
          const subcategory = await tx.subcategory.findUnique({
            where: { id: dto.subcategoryId },
            select: { slug: true },
          });
          subcategorySlug = subcategory?.slug;
        }

        const categoryValue = metadata.category ?? categorySlug;
        const subcategoryValue = metadata.subcategory ?? subcategorySlug;

        // create assets
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
              contentYear: dto.contentYear,
            },
          });

          createdAssets.push(asset);
        }

        // translations bulk insert
        await tx.fileTranslation.createMany({
          data: createdAssets.map((asset, index) => ({
            fileId: asset.id,
            languageCode: lang,
            displayName: normalizedFiles[index].displayName,
            description: normalizedFiles[index].description,
          })),
        });

        // metadata bulk insert
        const metadataRows = [];

        for (const asset of createdAssets) {
          if (categoryValue) {
            metadataRows.push({
              fileId: asset.id,
              key: 'category',
              value: categoryValue,
            });
          }

          if (subcategoryValue) {
            metadataRows.push({
              fileId: asset.id,
              key: 'subcategory',
              value: subcategoryValue,
            });
          }
        }

        if (metadataRows.length > 0) {
          await tx.fileMetadata.createMany({
            data: metadataRows,
          });
        }

        // update search vector once
        await tx.$executeRaw`
          UPDATE file_asset f
          SET search_vector =
            to_tsvector(
              'simple',
              COALESCE(
                (
                  SELECT string_agg(ft."displayName", ' ')
                  FROM file_translation ft
                  WHERE ft.file_id = f.id
                ),
                ''
              )
            )
          WHERE f.id IN (${createdAssets.map((a) => a.id)});
        `;

        return createdAssets;
      },
      {
        timeout: 20000,
      },
    );

    return {
      success: true,
      files: assets.map((file) => ({
        id: file.id,
        fileType: file.fileType,
        fileSize: file.fileSize,
        year: file.contentYear,
        url: this.fileService.getPublicUrl(file.storageKey),
        uploadedAt: file.uploadedAt,
      })),
    };
  }
}
