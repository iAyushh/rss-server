import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, FileType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

type NormalizedFileInput = {
  displayName: string;
  description?: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  extension: string;
  fileSize: number;
  fileType: FileType;
};

type FileWithMetadata = Prisma.FileAssetGetPayload<{
  include: { metadata: true };
}>;

@Injectable()
export class FileService {
  constructor(private readonly prisma: PrismaService) {}

  getPublicUrl(storageKey: string) {
    return `${process.env.APP_URL}/uploads/${storageKey}`;
  }

  private formatFile(file: FileWithMetadata) {
    return {
      id: file.id,
      contentTypeId: file.contentTypeId,
      displayName: file.displayName,
      description: file.description,
      originalName: file.originalName,
      fileSize: file.fileSize,
      fileType: file.fileType,
      uploadedAt: file.uploadedAt,
      url: this.getPublicUrl(file.storageKey),
      metadata: Object.fromEntries(file.metadata.map((m) => [m.key, m.value])),
    };
  }

  async attachFiles(
    tx: Prisma.TransactionClient,
    contentTypeId: number,
    files: NormalizedFileInput[],
    metadata?: Record<string, string>,
  ) {
    const assets: FileWithMetadata[] = [];

    for (const file of files) {
      const asset = await tx.fileAsset.create({
        data: {
          contentTypeId,
          displayName: file.displayName,
          description: file.description,
          originalName: file.originalName,
          storageKey: file.storageKey,
          mimeType: file.mimeType,
          extension: file.extension,
          fileSize: file.fileSize,
          fileType: file.fileType,
        },
        include: { metadata: true },
      });

      if (metadata) {
        await tx.fileMetadata.createMany({
          data: Object.entries(metadata).map(([key, value]) => ({
            fileId: asset.id,
            key,
            value,
          })),
        });
      }

      assets.push(asset);
    }

    return assets;
  }

  async deleteFile(id: number) {
    const file = await this.prisma.fileAsset.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('File not found');

    await this.prisma.$transaction([
      this.prisma.fileMetadata.deleteMany({ where: { fileId: id } }),
      this.prisma.fileAsset.delete({ where: { id } }),
    ]);

    await fs
      .unlink(path.join(process.cwd(), 'uploads', file.storageKey))
      .catch(() => {});

    return { success: true, deletedId: id };
  }

  async getFilesByContentType(contentTypeId: number) {
    const files = await this.prisma.fileAsset.findMany({
      where: { contentTypeId },
      orderBy: { uploadedAt: 'desc' },
      include: { metadata: true },
    });

    return files.map((f) => this.formatFile(f));
  }

  async getAllFiles(params?: {
    contentTypeId?: number;
    type?: FileType;
    skip?: number;
    take?: number;
  }) {
    const { contentTypeId, type, skip = 0, take = 20 } = params || {};

    const where: Prisma.FileAssetWhereInput = {
      ...(contentTypeId && { contentTypeId }),
      ...(type && { fileType: type }),
    };

    const [files, total] = await Promise.all([
      this.prisma.fileAsset.findMany({
        where,
        include: { metadata: true },
        skip,
        take,
        orderBy: { uploadedAt: 'desc' },
      }),
      this.prisma.fileAsset.count({ where }),
    ]);

    return {
      files: files.map((f) => this.formatFile(f)),
      total,
    };
  }

  async getFilesByCategory(
    categoryId: number,
    params: {
      lang: string;
      type?: FileType;
      skip?: number;
      take?: number;
    },
  ) {
    const { lang, type, skip = 0, take = 20 } = params;

    // 🔤 translation with fallback
    let translation = await this.prisma.categoryTranslation.findFirst({
      where: { categoryId, languageCode: lang },
      select: { name: true },
    });

    if (!translation) {
      translation = await this.prisma.categoryTranslation.findFirst({
        where: { categoryId, languageCode: 'hi' },
        select: { name: true },
      });
    }

    if (!translation) return { files: [], total: 0 };

    const files = await this.prisma.fileAsset.findMany({
      where: {
        ...(type && { fileType: type }),
        metadata: {
          some: {
            key: 'category',
            value: translation.name,
          },
        },
        // direct category uploads only
        AND: [
          {
            metadata: {
              none: {
                key: 'subcategory',
                value: { not: '' },
              },
            },
          },
        ],
      },
      include: { metadata: true },
      skip,
      take,
      orderBy: { uploadedAt: 'desc' },
    });

    return {
      files: files.map((f) => this.formatFile(f)),
      total: files.length,
    };
  }

  async getFilesBySubcategory(
    subcategoryId: number,
    params: {
      lang: string;
      type?: FileType;
      skip?: number;
      take?: number;
    },
  ) {
    const { lang, type, skip = 0, take = 20 } = params;

    let translation = await this.prisma.subcategoryTranslation.findFirst({
      where: { subcategoryId, languageCode: lang },
      select: { name: true },
    });

    if (!translation) {
      translation = await this.prisma.subcategoryTranslation.findFirst({
        where: { subcategoryId, languageCode: 'hi' },
        select: { name: true },
      });
    }

    if (!translation) return { files: [], total: 0 };

    const files = await this.prisma.fileAsset.findMany({
      where: {
        ...(type && { fileType: type }),
        metadata: {
          some: {
            key: 'subcategory',
            value: translation.name,
          },
        },
      },
      include: { metadata: true },
      skip,
      take,
      orderBy: { uploadedAt: 'desc' },
    });

    return {
      files: files.map((f) => this.formatFile(f)),
      total: files.length,
    };
  }
}
