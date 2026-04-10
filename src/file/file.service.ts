import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { Prisma, FileType } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { FileTranslationDto } from './dto';

import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from 'src/configs/amazonS3.config';
import { FileCategory } from 'src/common/types';

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

const categoryToTypesMap: Record<FileCategory, FileType[]> = {
  media: ['IMAGE', 'VIDEO', 'AUDIO'],
  docs: ['PDF', 'WORD', 'TEXT'],
  reports: ['CSV', 'EXCEL'],
  others: ['OTHER'],
};


@Injectable()
export class FileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) { }

  getPublicUrl(storageKey: string) {
    return storageKey;
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

  private extractPublicId(url: string): string {
    try {
      const parts = url.split('/upload/')[1];
      const withoutVersion = parts.replace(/v\d+\//, '');
      const publicId = withoutVersion.split('.').slice(0, -1).join('.');
      return publicId;
    } catch (err) {
      console.warn('Failed to extract public_id from URL');
      return '';
    }
  }

  private formatFile(
    file: FileWithRelations,
    lang: string,
    categoryMap?: Map<number, string>,
    subcategoryMap?: Map<number, string>,
  ) {
    const translation = this.resolveTranslation(file.translations ?? [], lang);

    const metadata =
      file.metadata?.reduce(
        (acc, m) => {
          acc[m.key] = m.value;
          return acc;
        },
        {} as Record<string, string>,
      ) ?? {};

    if (metadata.categoryId && categoryMap) {
      const categoryName = categoryMap.get(Number(metadata.categoryId));
      if (categoryName) {
        metadata.category = categoryName;
      }
    }

    if (metadata.subcategoryId && subcategoryMap) {
      const subcategoryName = subcategoryMap.get(
        Number(metadata.subcategoryId),
      );
      if (subcategoryName) {
        metadata.subcategory = subcategoryName;
      }
    }

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


  async getFileStats() {
    const data = await this.prisma.fileAsset.groupBy({
      by: ['fileType'],
      _count: true,
    });

    let totalFiles = 0;
    let totalMedia = 0;
    let totalDocs = 0;
    let totalReports = 0;

    data.forEach((item) => {
      const count = item._count;

      totalFiles += count;

      if (['IMAGE', 'VIDEO', 'AUDIO'].includes(item.fileType)) {
        totalMedia += count;
      } else if (['PDF', 'WORD', 'TEXT'].includes(item.fileType)) {
        totalDocs += count;
      } else if (['CSV', 'EXCEL'].includes(item.fileType)) {
        totalReports += count;
      }
    });

    return {
      totalFiles,
      totalDocs,
      totalMedia,
      totalReports,
    };
  }

  async getCombinedFiles(options: {
    type?: FileCategory;
    skip: number;
    take: number;
    lang: string;
  }) {
    const { type, skip, take, lang } = options;


    const categoryToTypesMap: Record<FileCategory, FileType[]> = {
      [FileCategory.MEDIA]: ['IMAGE', 'VIDEO', 'AUDIO'],
      [FileCategory.DOCS]: ['PDF', 'WORD', 'TEXT'],
      [FileCategory.REPORTS]: ['CSV', 'EXCEL'],
      [FileCategory.OTHERS]: ['OTHER'],
    };

    const fileTypes = type ? categoryToTypesMap[type] : undefined;

    const where = {
      ...(fileTypes && {
        fileType: {
          in: fileTypes,
        },
      }),
    };


    const [files, total] = await Promise.all([
      this.prisma.fileAsset.findMany({
        where,
        skip,
        take,
        orderBy: [{ contentYear: 'desc' }, { updatedAt: 'desc' }],

        include: {
          translations: true,
          metadata: true,
        },
      }),

      this.prisma.fileAsset.count({ where }),
    ]);


    const categoryIds = new Set<number>();
    const subcategoryIds = new Set<number>();

    files.forEach((f) => {
      const cat = f.metadata.find((m) => m.key === 'categoryId')?.value;
      const sub = f.metadata.find((m) => m.key === 'subcategoryId')?.value;

      if (cat) categoryIds.add(Number(cat));
      if (sub) subcategoryIds.add(Number(sub));
    });


    const [categories, subcategories] = await Promise.all([
      this.prisma.category.findMany({
        where: { id: { in: Array.from(categoryIds) } },
        include: { translations: true },
      }),
      this.prisma.subcategory.findMany({
        where: { id: { in: Array.from(subcategoryIds) } },
        include: { translations: true },
      }),
    ]);


    const categoryMap = new Map<number, string>();
    categories.forEach((c) => {
      const name =
        c.translations.find((t) => t.languageCode === lang)?.name ||
        c.translations[0]?.name;

      if (name) categoryMap.set(c.id, name);
    });

    const subcategoryMap = new Map<number, string>();
    subcategories.forEach((s) => {
      const name =
        s.translations.find((t) => t.languageCode === lang)?.name ||
        s.translations[0]?.name;

      if (name) subcategoryMap.set(s.id, name);
    });


    return {
      data: files.map((f) => {
        const categoryId = Number(
          f.metadata.find((m) => m.key === 'categoryId')?.value,
        );

        const subcategoryId = Number(
          f.metadata.find((m) => m.key === 'subcategoryId')?.value,
        );

        return {
          id: f.id,
          fileType: f.fileType,
          url: f.url,
          fileSize: f.fileSize,
          contentYear: f.contentYear,
          uploadedAt: f.uploadedAt,


          category: categoryMap.get(categoryId) || null,
          subcategory: subcategoryMap.get(subcategoryId) || null,

          displayName:
            f.translations.find((t) => t.languageCode === lang)?.displayName ||
            f.translations[0]?.displayName ||
            f.originalName,
        };
      }),

      total,
      skip,
      take,
    };
  }



  async getAllFiles(options: {
    contentTypeId?: number;
    type?: FileCategory;
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

    let fileTypes: FileType[] | undefined;

    if (type) {
      fileTypes = categoryToTypesMap[type];
    }

    const where = {
      ...(contentTypeId && { contentTypeId }),
      ...(fileTypes && {
        fileType: {
          in: fileTypes,
        },
      }),
    };

    const validSortFields = ['updatedAt', 'fileSize', 'originalName'];
    const validOrders = ['asc', 'desc'];

    const cleanSortBy = validSortFields.includes(sortBy as string)
      ? sortBy
      : undefined;

    const cleanOrder = validOrders.includes(order as string) ? order : 'desc';

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

    const categoryIds = files
      .map((f) => f.metadata.find((m) => m.key === 'categoryId')?.value)
      .filter(Boolean)
      .map(Number);

    const subcategoryIds = files
      .map((f) => f.metadata.find((m) => m.key === 'subcategoryId')?.value)
      .filter(Boolean)
      .map(Number);

    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      include: { translations: true },
    });

    const subcategories = await this.prisma.subcategory.findMany({
      where: { id: { in: subcategoryIds } },
      include: { translations: true },
    });

    const categoryMap = new Map<number, string>();
    categories.forEach((c) => {
      const name =
        c.translations?.find((t) => t.languageCode === lang)?.name ||
        c.translations?.[0]?.name;

      if (name) categoryMap.set(c.id, name);
    });

    const subcategoryMap = new Map<number, string>();
    subcategories.forEach((s) => {
      const name =
        s.translations?.find((t) => t.languageCode === lang)?.name ||
        s.translations?.[0]?.name;

      if (name) subcategoryMap.set(s.id, name);
    });

    return {
      data: files.map((f) =>
        this.formatFile(f as any, lang, categoryMap, subcategoryMap),
      ),
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

    const categoryName = category.translations?.[0]?.name?.trim();

    const where: Prisma.FileAssetWhereInput = {
      ...(type && { fileType: type }),

      OR: [
        {
          metadata: {
            some: {
              AND: [{ key: 'categoryId' }, { value: String(categoryId) }],
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

    const categoryIds = files
      .map((f) => f.metadata.find((m) => m.key === 'categoryId')?.value)
      .filter(Boolean)
      .map(Number);

    const subcategoryIds = files
      .map((f) => f.metadata.find((m) => m.key === 'subcategoryId')?.value)
      .filter(Boolean)
      .map(Number);

    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      include: { translations: true },
    });

    const subcategories = await this.prisma.subcategory.findMany({
      where: { id: { in: subcategoryIds } },
      include: { translations: true },
    });

    const categoryMap = new Map<number, string>();
    categories.forEach((c) => {
      const name =
        c.translations?.find((t) => t.languageCode === lang)?.name ||
        c.translations?.[0]?.name;

      if (name) categoryMap.set(c.id, name);
    });

    const subcategoryMap = new Map<number, string>();
    subcategories.forEach((s) => {
      const name =
        s.translations?.find((t) => t.languageCode === lang)?.name ||
        s.translations?.[0]?.name;

      if (name) subcategoryMap.set(s.id, name);
    });

    return {
      files: files.map((f) =>
        this.formatFile(f, lang, categoryMap, subcategoryMap),
      ),
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

    const subcategoryNames = subcategory?.translations.map((t) => t.name) || [];

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
              key: 'subcategoryId',
              value: String(subcategoryId),
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
    skip = 0,
    take = 20,
  ) {
    if (groupBy === 'year') {
      const result = await this.prisma.fileAsset.groupBy({
        by: ['contentYear'],
        _count: { id: true },
        orderBy: { contentYear: 'desc' },
      });

      const total = result.length;

      const paginated = result.slice(skip, skip + take);

      return {
        data: paginated.map((r) => ({
          year: r.contentYear,
          count: r._count.id,
        })),
        total,
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

      const total = contentTypes.length;

      const paginated = contentTypes.slice(skip, skip + take);

      return {
        data: paginated.map((ct) => {
          const t =
            ct.translations.find((tr) => tr.languageCode === lang) ??
            ct.translations[0];

          return {
            id: ct.id,
            name: t?.name,
            count: ct._count.files,
          };
        }),
        total,
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

      const total = categories.length;

      const paginated = categories.slice(skip, skip + take);

      return {
        data: paginated.map((cat) => {
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
        total,
      };
    }

    return { data: [], total: 0 };
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

    try {
      if (file.storageKey) {

        const url = new URL(file.storageKey);
        const key = url.pathname.substring(1);

        await s3.send(
          new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME!,
            Key: key,
          }),
        );
      }
    } catch (err) {
      console.warn('S3 deletion failed:', err.message);
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

    return {
      success: true,
      deletedId: id,
    };
  }
}
