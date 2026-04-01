import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';
import { IngestionDto } from './dto';
import { FILE_TYPE_MIME_MAP } from '../common/constants/file-type-mime.map';
import { FileType, Prisma } from '@prisma/client';
import * as path from 'node:path';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class IngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
    private readonly i18n: I18nService,
  ) { }


  private validateFiles(files: Express.Multer.File[], type: FileType | undefined, lang: string) {

    if (!type) {
      console.log('No file type provided, skipping validation');
      return;
    }
    const allowedMimes = FILE_TYPE_MIME_MAP[type];
    if (!allowedMimes.length) return;

    for (const file of files) {
      if (!allowedMimes.includes(file.mimetype)) {
        throw new BadRequestException(
          this.i18n.t('common.errors.INVALID_FILE_TYPE', { lang }),
        );
      }
    }
  }

  async ingest(dto: IngestionDto, files: Express.Multer.File[]) {
    let metadata: Record<string, any> = {};

    // ✅ parse optional metadata safely
    if (dto.metadata) {
      try {
        metadata = JSON.parse(dto.metadata);
      } catch {
        throw new BadRequestException('Invalid metadata JSON');
      }
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const contentType = await this.prisma.contentType.findUnique({
      where: { id: dto.contentTypeId },
    });

    if (!contentType) {
      throw new BadRequestException('Invalid contentTypeId');
    }

    this.validateFiles(files, dto.type, dto.lang ?? 'hi');

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

    const assets = await this.prisma.$transaction(async (tx) => {
      const lang = dto.lang ?? 'hi';
      const baseUrl = process.env.APP_URL + '/uploads';

      const createdAssets = [];

      for (const file of normalizedFiles) {
        const fileUrl = `${baseUrl}/${file.storageKey}`;
        const finalType = dto.type ?? FileType.OTHER;

        // ✅ Create file asset
        const asset = await tx.fileAsset.create({
          data: {
            contentTypeId: dto.contentTypeId,
            originalName: file.originalName,
            storageKey: file.storageKey,
            mimeType: file.mimeType,
            extension: file.extension,
            fileSize: file.fileSize,
            fileType: finalType,
            contentYear: dto.contentYear,
            url: fileUrl,
          },
        });

        // ✅ Translation
        await tx.fileTranslation.create({
          data: {
            fileId: asset.id,
            languageCode: lang,
            displayName: file.displayName,
            description: file.description,
          },
        });

        // ✅ Metadata building (CLEAN)
        const metadataRows: { key: string; value: string }[] = [];

        // 🔥 CORE FIX: store IDs (NOT names)
        if (dto.categoryId) {
          metadataRows.push({
            key: 'categoryId',
            value: String(dto.categoryId),
          });
        }

        if (dto.subcategoryId) {
          metadataRows.push({
            key: 'subcategoryId',
            value: String(dto.subcategoryId),
          });
        }

        // ✅ Optional extra metadata (safe merge)
        for (const [key, value] of Object.entries(metadata)) {
          if (
            value !== undefined &&
            value !== null &&
            !['category', 'subcategory'].includes(key) // ❌ prevent old buggy keys
          ) {
            metadataRows.push({
              key,
              value: String(value),
            });
          }
        }

        // ✅ Insert metadata
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

    // ✅ Search vector update
    const ids = assets.map((a) => a.id);

    if (ids.length > 0) {
      await this.prisma.$executeRaw`
      UPDATE file_asset f
      SET search_vector =
        to_tsvector(
          'simple',
          COALESCE(
            (
              SELECT string_agg(ft."displayName",' ')
              FROM file_translation ft
              WHERE ft.file_id = f.id
            ),
            ''
          )
        )
      WHERE f.id IN (${Prisma.join(ids)});
    `;
    }

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
