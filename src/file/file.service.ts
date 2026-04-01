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

  async getFilesByContentType(
    contentTypeId: number,
    params?: { skip?: number; take?: number; type?: FileType; lang?: string },
  ) {
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
    };
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


    const validSortFields = ['updatedAt', 'fileSize', 'originalName'];
    const validOrders = ['asc', 'desc'];

    const cleanSortBy = validSortFields.includes(sortBy as string)
      ? sortBy
      : undefined;

    const cleanOrder = validOrders.includes(order as string)
      ? order
      : 'desc';

    const orderBy:
      | Prisma.FileAssetOrderByWithRelationInput
      | Prisma.FileAssetOrderByWithRelationInput[] = cleanSortBy
        ? { [cleanSortBy]: cleanOrder }
        : [{ contentYear: 'desc' }, { updatedAt: 'desc' }];

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

  async getFilesByCategory(categoryId: number, params?: any) {
    const { skip = 0, take = 20, type, lang = 'hi' } = params || {};

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: { translations: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const categoryName =
      category.translations?.[0]?.name?.trim();

    const where: Prisma.FileAssetWhereInput = {
      ...(type && { fileType: type }),

      OR: [
       
        {
          metadata: {
            some: {
              AND: [
                { key: 'categoryId' },
                { value: String(categoryId) },
              ],
            },
          },
        },

        {
          metadata: {
            some: {
              AND: [
                { key: 'category' },
                {
                  value: {
                    equals: categoryName,
                    mode: 'insensitive',
                  },
                },
              ],
            },
          },
        },
      ],
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


    const subcategory = await this.prisma.subcategory.findUnique({
      where: { id: subcategoryId },
      include: {
        translations: true,
      },
    });

    const subcategoryNames =
      subcategory?.translations.map(t => t.name) || [];

    const where: Prisma.FileAssetWhereInput = {
      ...(type && { fileType: type }),

      OR: [

        {
          contentType: {
            subcategoryId,
          },
        },


        {
          metadata: {
            some: {
              key: 'subcategory',
              value: {
                in: subcategoryNames,
              },
            },
          },
        },
      ],
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
        orderBy: [{ contentYear: 'desc' }, { updatedAt: 'desc' }],
      }),
      this.prisma.fileAsset.count({ where }),
    ]);

    return {
      data: files.map((f) => this.formatFile(f, lang)),
      total,
      skip,
      take,
    };
  }


  async getFileIndex(
    groupBy: 'year' | 'contentType' | 'category',
    lang: string,
  ) {

    if (groupBy === 'year') {
      const result = await this.prisma.fileAsset.groupBy({
        by: ['contentYear'],
        _count: { id: true },
        orderBy: { contentYear: 'desc' },
      });

      return {
        data: result.map((r) => ({
          year: r.contentYear,
          count: r._count.id,
        })),
      };
    }

    if (groupBy === 'contentType') {
      const contentTypes = await this.prisma.contentType.findMany({
        include: {
          translations: true,
          _count: {
            select: { files: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        data: contentTypes.map((ct) => {
          const t =
            ct.translations.find((tr) => tr.languageCode === lang) ??
            ct.translations[0];

          return {
            id: ct.id,
            name: t?.name,
            count: ct._count.files,
          };
        }),
      };
    }


    if (groupBy === 'category') {
      const categories = await this.prisma.category.findMany({
        include: {
          translations: true,
          contentTypes: {
            include: {
              _count: {
                select: { files: true },
              },
            },
          },
        },
      });

      return {
        data: categories.map((cat) => {
          const t =
            cat.translations.find((tr) => tr.languageCode === lang) ??
            cat.translations[0];

          const totalFiles = cat.contentTypes.reduce(
            (sum, ct) => sum + ct._count.files,
            0,
          );

          return {
            id: cat.id,
            name: t?.name,
            count: totalFiles,
          };
        }),
      };
    }

    return { data: [] };
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
