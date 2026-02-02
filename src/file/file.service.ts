import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, FileType, FileTranslation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { I18nService } from 'nestjs-i18n';
import { UpdateFileRequestDto } from './dto';

type FileWithRelations = Prisma.FileAssetGetPayload<{
  include: {
    metadata: true;
    translations: true;
  };
}>;

@Injectable()
export class FileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  getPublicUrl(storageKey: string) {
    return `${process.env.APP_URL}/uploads/${storageKey}`;
  }
  private resolveTranslation(
    translations: FileTranslation[],
    lang: string,
  ): FileTranslation | null {
    if (!translations?.length) return null;

    let translation = translations.find((t) => t.languageCode === lang);

    if (!translation && lang !== 'hi') {
      translation = translations.find((t) => t.languageCode === 'hi');
    }

    return translation ?? translations[0];
  }

  private formatFile(file: FileWithRelations, lang: string) {
    const translation = this.resolveTranslation(file.translations, lang);

    return {
      id: file.id,
      contentTypeId: file.contentTypeId,

      lang: translation?.languageCode ?? lang,
      displayName: translation?.displayName ?? file.originalName,
      description: translation?.description ?? null,

      originalName: file.originalName,
      fileSize: file.fileSize,
      fileType: file.fileType,
      uploadedAt: file.uploadedAt,

      url: this.getPublicUrl(file.storageKey),

      metadata: Object.fromEntries(file.metadata.map((m) => [m.key, m.value])),
    };
  }

  async getFilesByContentType(contentTypeId: number, lang: string) {
    const files = await this.prisma.fileAsset.findMany({
      where: { contentTypeId },
      include: {
        metadata: true,
        translations: true,
      },
      orderBy: { uploadedAt: 'desc' },
    });

    return files.map((f) => this.formatFile(f, lang));
  }

  async getAllFiles(params: {
    contentTypeId?: number;
    type?: FileType;
    skip?: number;
    take?: number;
    lang: string;
  }) {
    const { contentTypeId, type, skip = 0, take = 20, lang } = params;

    const where: Prisma.FileAssetWhereInput = {
      ...(contentTypeId && { contentTypeId }),
      ...(type && { fileType: type }),
    };

    const [files, total] = await Promise.all([
      this.prisma.fileAsset.findMany({
        where,
        include: {
          metadata: true,
          translations: true,
        },
        skip,
        take,
        orderBy: { uploadedAt: 'desc' },
      }),
      this.prisma.fileAsset.count({ where }),
    ]);

    return {
      files: files.map((f) => this.formatFile(f, lang)),
      total,
    };
  }

  async getFilesByCategory(
    categoryId: number,
    params?: {
      skip?: number;
      take?: number;
      type?: FileType;
      lang: string;
    },
  ) {
    const { skip = 0, take = 20, type, lang = 'hi' } = params || {};

    let translation = await this.prisma.categoryTranslation.findFirst({
      where: {
        categoryId,
        languageCode: lang,
      },
      select: { name: true },
    });
    if (!translation) {
      translation = await this.prisma.categoryTranslation.findFirst({
        where: {
          categoryId,
          languageCode: 'hi',
        },
        select: {
          name: true,
        },
      });
    }

    if (!translation) {
      return { files: [], total: 0 };
    }

    const files = await this.prisma.fileAsset.findMany({
      where: {
        ...(type && { fileType: type }),

        metadata: {
          some: {
            key: 'category',
            value: translation.name,
          },
        },

        // subcategory NOT present (direct uploads)
        AND: [
          {
            metadata: {
              none: {
                key: 'subcategory',
                value: {
                  not: '',
                },
              },
            },
          },
        ],
      },
      include: { metadata: true, translations: true },
      orderBy: { uploadedAt: 'desc' },
      skip,
      take,
    });

    return {
      files: files.map((f) => this.formatFile(f, lang)),
      total: files.length,
    };
  }

  async getFilesBySubcategory(
    subcategoryId: number,
    params?: {
      skip?: number;
      take?: number;
      type?: FileType;
      lang: string;
    },
  ) {
    const { skip = 0, take = 20, type, lang = 'hi' } = params || {};

    let translation = await this.prisma.subcategoryTranslation.findFirst({
      where: {
        subcategoryId,
        languageCode: lang,
      },
      select: {
        name: true,
      },
    });

    if (!translation) {
      translation = await this.prisma.subcategoryTranslation.findFirst({
        where: {
          subcategoryId,
          languageCode: 'hi',
        },
        select: {
          name: true,
        },
      });
    }
    if (!translation) {
      return {
        files: [],
        total: 0,
      };
    }
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
      include: { metadata: true, translations: true },
      orderBy: { uploadedAt: 'desc' },
      skip,
      take,
    });

    return {
      files: files.map((f) => this.formatFile(f, lang)),
      total: files.length,
    };
  }

  async update(fileId: number, dto: UpdateFileRequestDto) {
    const file = await this.prisma.fileAsset.findUnique({
      where: { id: fileId },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (dto.translations?.length) {
      await this.prisma.$transaction(
        dto.translations.map((t) =>
          this.prisma.fileTranslation.upsert({
            where: {
              fileId_languageCode: {
                fileId,
                languageCode: t.languageCode,
              },
            },
            update: {
              displayName: t.displayName,
              description: t.description ?? null,
            },
            create: {
              fileId,
              languageCode: t.languageCode,
              displayName: t.displayName,
              description: t.description ?? null,
            },
          }),
        ),
      );
    }
    return {
      success: true,
      fileId,
    };
  }

  async deleteFile(id: number) {
    const file = await this.prisma.fileAsset.findUnique({
      where: { id },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    await this.prisma.$transaction([
      this.prisma.fileMetadata.deleteMany({
        where: { fileId: id },
      }),
      this.prisma.fileTranslation.deleteMany({
        where: { fileId: id },
      }),
      this.prisma.fileAsset.delete({
        where: { id },
      }),
    ]);

    await fs
      .unlink(path.join(process.cwd(), 'uploads', file.storageKey))
      .catch(() => {});

    return { success: true, deletedId: id };
  }
}
