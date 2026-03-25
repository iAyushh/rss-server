import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { Prisma, FileType } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileTranslationDto } from './dto';

type FileWithRelations = Prisma.FileAssetGetPayload<{
  include: {
    metadata: { select: { key: true; value: true } };
    translations: {
      select: {
        languageCode: true;
        displayName: true;
        description: true;
      };
    };
  };
}>;

type FileTranslationLite = {
  languageCode: string;
  displayName: string;
  description: string | null;
};

@Injectable()
export class FileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) { }

  getPublicUrl(storageKey: string) {
    return `${process.env.APP_URL ?? ''}/uploads/${storageKey}`;
  }

  private resolveTranslation(
    translations: FileTranslationLite[] = [],
    lang: string,
  ): FileTranslationLite | null {
    if (!translations.length) return null;

    let translation = translations.find((t) => t.languageCode === lang);

    if (!translation) {
      translation =
        translations.find((t) => t.languageCode === 'hi') ?? translations[0];
    }

    return translation ?? null;
  }

  private formatFile(file: FileWithRelations, lang: string) {
    const translation = this.resolveTranslation(file.translations ?? [], lang);

    const metadata =
      file.metadata?.reduce(
        (acc, m) => {
          acc[m.key] = m.value;
          return acc;
        },
        {} as Record<string, string>,
      ) ?? {};

    return {
      id: file.id,
      contentTypeId: file.contentTypeId,

      lang: translation?.languageCode ?? lang,
      displayName: translation?.displayName ?? file.originalName,
      description: translation?.description ?? null,

      originalName: file.originalName,
      fileSize: file.fileSize,
      fileType: file.fileType,

      year: file.contentYear,
      uploadedAt: file.uploadedAt,

      url: this.getPublicUrl(file.storageKey),

      metadata,
    };
  }

  async getAllContentTypes(lang: string) {
    const contentTypes = await this.prisma.contentType.findMany({
      select: {
        id: true,
        slug: true,
        translations: {
          where: { languageCode: lang },
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });


    return contentTypes.map((ct) => ({
      id: ct.id,
      name: ct.translations[0]?.name || '',
    }));
  }

  async getFilesByContentType(contentTypeId: number, params?: { skip?: number; take?: number; type?: FileType; lang?: string }) {
    const { skip = 0, take = 20, type, lang = 'hi' } = params || {};

    const where: Prisma.FileAssetWhereInput = {
      contentTypeId,
      ...(type && { fileType: type }),
    };

    const [files, total] = await Promise.all([
      this.prisma.fileAsset.findMany({
        where,
        include: {
          metadata: { select: { key: true, value: true } },
          translations: {
            select: {
              languageCode: true,
              displayName: true,
              description: true,
            },
          },
        },
        skip,
        take,
        orderBy: [{ contentYear: 'desc' }, { uploadedAt: 'desc' }],
      }),
      this.prisma.fileAsset.count({ where }),

    ]);
    return {
      files: files.map((f) => this.formatFile(f, lang)),
      total,
      skip,
      take,
    }
  }

  async getAllFiles(options: {
    contentTypeId?: number;
    type?: FileType;
    sortBy?: 'updatedAt' | 'fileSize' | 'originalName';
    order?: 'asc' | 'desc';
    skip?: number;
    take?: number;
    lang: string;
  }) {
    const {
      contentTypeId,
      type,
      sortBy,
      order = 'desc',
      skip = 0,
      take = 20,
      lang,
    } = options;

    const where = {
      ...(contentTypeId && { contentTypeId }),
      ...(type && { fileType: type }),
    };

    const orderBy: Prisma.FileAssetOrderByWithRelationInput | Prisma.FileAssetOrderByWithRelationInput[] =
      sortBy
        ? { [sortBy]: order }
        : [
          { contentYear: 'desc' },
          { updatedAt: 'desc' },
        ];

    const [files, total] = await Promise.all([
      this.prisma.fileAsset.findMany({
        where,
        include: {
          contentType: {
            include: {
              translations: true,
            },
          },
          metadata: {
            select: { key: true, value: true },
          },
          translations: {
            where: { languageCode: lang },
            select: {
              languageCode: true,
              displayName: true,
              description: true,
            },
          },
        },
        skip,
        take,
        orderBy,
      }),

      this.prisma.fileAsset.count({
        where,
      }),
    ]);

    return {
      data: files.map((f) => this.formatFile(f as any, lang)),
      total,
      skip,
      take,
    };
  }

  async getFilesByCategory(
    categoryId: number,
    params?: {
      skip?: number;
      take?: number;
      type?: FileType;
      lang?: string;
    },
  ) {
    const { skip = 0, take = 20, type, lang = 'hi' } = params || {};

    const where: Prisma.FileAssetWhereInput = {
      ...(type && { fileType: type }),
      contentType: {
        categoryId,
      },
    };

    const [files, total] = await Promise.all([
      this.prisma.fileAsset.findMany({
        where,
        include: {
          metadata: { select: { key: true, value: true } },
          translations: {
            select: {
              languageCode: true,
              displayName: true,
              description: true,
            },
          },
        },
        skip,
        take,
        orderBy: [{ contentYear: 'desc' }, { uploadedAt: 'desc' }],
      }),
      this.prisma.fileAsset.count({ where }),
    ]);

    return {
      files: files.map((f) => this.formatFile(f, lang)),
      total,
    };
  }

  async getFilesBySubcategory(
    subcategoryId: number,
    params?: {
      skip?: number;
      take?: number;
      type?: FileType;
      lang?: string;
    },
  ) {
    const { skip = 0, take = 20, type, lang = 'hi' } = params || {};

    const where: Prisma.FileAssetWhereInput = {
      ...(type && { fileType: type }),
      contentType: {
        subcategoryId,
      },
    };

    const [files, total] = await Promise.all([
      this.prisma.fileAsset.findMany({
        where,
        include: {
          metadata: { select: { key: true, value: true } },
          translations: {
            select: {
              languageCode: true,
              displayName: true,
              description: true,
            },
          },
        },
        skip,
        take,
        orderBy: [{ contentYear: 'desc' }, { uploadedAt: 'desc' }],
      }),
      this.prisma.fileAsset.count({ where }),
    ]);

    return {
      files: files.map((f) => this.formatFile(f, lang)),
      total,
    };
  }

  async update(fileId: number, dto: any) {
    const file = await this.prisma.fileAsset.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (dto.translations?.length) {
      await this.prisma.$transaction(
        dto.translations.map((t: FileTranslationDto) =>
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

      await this.prisma.$executeRaw`
        UPDATE file_asset f
        SET search_vector =
          to_tsvector(
            'simple',
            COALESCE(
              (SELECT string_agg(ft."displayName", ' ')
               FROM file_translation ft
               WHERE ft.file_id = f.id),
              ''
            )
          )
        WHERE f.id = ${fileId};
      `;
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
      .catch((err) => {
        console.warn('File deletion failed:', err.message);
      });

    return {
      success: true,
      deletedId: id,
    };
  }
}
