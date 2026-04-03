import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';
import { IngestionDto } from './dto';
import { FILE_TYPE_MIME_MAP } from '../common/constants/file-type-mime.map';
import { FileType, Prisma } from '@prisma/client';
import * as path from 'node:path';
import { I18nService } from 'nestjs-i18n';
import cloudinary from 'src/configs/cloudinary.config';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from 'src/configs/amazonS3.config';

@Injectable()
export class IngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
    private readonly i18n: I18nService,
  ) {}

  private async uploadToCloudinary(file: Express.Multer.File): Promise<string> {
    return new Promise((resolve, reject) => {
      const originalName = file.originalname;
      const baseName = originalName.replace(/\.[^/.]+$/, '');

      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'rss-uploads',
          resource_type: 'raw',
          public_id: baseName,
          overwrite: true,
          access_mode: 'public',
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }

          resolve(result?.secure_url || '');
        },
      );

      stream.end(file.buffer);
    });
  }

  async uploadToS3(file: Express.Multer.File): Promise<string> {
    const fileName = `${Date.now()}-${file.originalname}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: `rss-uploads/${fileName}`,
      Body: file.buffer,

      ContentType: file.mimetype,

      ContentDisposition: 'inline',
    });

    await s3.send(command);

    return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/rss-uploads/${fileName}`;
  }

  private validateFiles(
    files: Express.Multer.File[],
    type: FileType | undefined,
    lang: string,
  ) {
    if (!type) {
      console.log('No file type provided, skipping validation');
      return;
    }

    const allowedMimes = FILE_TYPE_MIME_MAP[type];
    if (allowedMimes?.length) {
      for (const file of files) {
        if (!allowedMimes.includes(file.mimetype)) {
          throw new BadRequestException(
            this.i18n.t('common.errors.INVALID_FILE_TYPE', { lang }),
          );
        }
      }
    }

    const MAX_SIZE = 100 * 1024 * 1024; // 100MB

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        throw new BadRequestException(
          this.i18n.t('common.errors.FILE_TOO_LARGE', {
            lang,
            args: { max: '100MB' },
          }) || 'File too large. Max allowed size is 100MB',
        );
      }
    }
  }

  async ingest(dto: IngestionDto, files: Express.Multer.File[]) {
    let metadata: Record<string, any> = {};

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

    const normalizedFiles: {
      originalName: string;
      storageKey: string;
      url: string;
      mimeType: string;
      extension: string;
      fileSize: number;
      fileType: FileType | undefined;
      displayName: string;
      description: string | null;
    }[] = [];

    for (const file of files) {
      const url = await this.uploadToS3(file);

      normalizedFiles.push({
        originalName: file.originalname,
        storageKey: url,
        url,
        mimeType: file.mimetype,
        extension: path.extname(file.originalname),
        fileSize: file.size,
        fileType: dto.type,
        displayName: dto.displayName || file.originalname,
        description: dto.description ?? null,
      });
    }

    const assets = await this.prisma.$transaction(async (tx) => {
      const lang = dto.lang ?? 'hi';

      const createdAssets = [];

      for (const file of normalizedFiles) {
        const finalType = dto.type ?? FileType.OTHER;

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
            url: file.url,
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

        for (const [key, value] of Object.entries(metadata)) {
          if (
            value !== undefined &&
            value !== null &&
            !['category', 'subcategory'].includes(key)
          ) {
            metadataRows.push({
              key,
              value: String(value),
            });
          }
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
        url: file.url,
        uploadedAt: file.uploadedAt,
      })),
    };
  }
}
