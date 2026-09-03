import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { Prisma, FileType } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileTranslationDto, BulkCreateFilesDto } from './dto';

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

  private determineFileType(mimetype: string): FileType {
    if (mimetype.startsWith('image/')) return 'IMAGE';
    if (mimetype.startsWith('video/')) return 'VIDEO';
    if (mimetype.startsWith('audio/')) return 'AUDIO';
    if (mimetype === 'application/pdf') return 'PDF';
    if (mimetype.includes('msword') || mimetype.includes('officedocument.wordprocessingml')) return 'WORD';
    if (mimetype.includes('excel') || mimetype.includes('spreadsheetml')) return 'EXCEL';
    if (mimetype.includes('csv')) return 'CSV';
    if (mimetype.startsWith('text/')) return 'TEXT';
    return 'OTHER';
  }

  private async _recalculateSearchVector(fileId: number) {
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
          ) || ' ' ||
          COALESCE(f.original_name, '') || ' ' ||
          COALESCE(f.event_name, '') || ' ' ||
          COALESCE(f.content_year::text, '') || ' ' ||
          COALESCE(
            (SELECT string_agg(t.name, ' ')
             FROM tag t
             JOIN "_FileAssetToTag" fat ON fat."B" = t.id
             WHERE fat."A" = f.id),
            ''
          )
        )
      WHERE f.id = ${fileId};
    `;
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
      parentId: (file as any).categoryId,
      tags: (file as any).tags?.map((t: any) => t.name) ?? [],

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
          tags: true,
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
    tags?: string;
    eventName?: string;
    year?: number;
    name?: string;
    sortBy?: 'updatedAt' | 'fileSize' | 'originalName';
    order?: 'asc' | 'desc';
    skip?: number;
    take?: number;
    lang: string;
  }) {
    const {
      contentTypeId,
      type,
      tags,
      eventName,
      year,
      name,
      sortBy,
      order = 'desc',
      skip = 0,
      take = 20,
      lang,
    } = options;

    const where: Prisma.FileAssetWhereInput = {
      ...(contentTypeId && { contentTypeId }),
      ...(type && { fileType: type }),
      ...(eventName && { eventName: { contains: eventName, mode: 'insensitive' } }),
      ...(year && { contentYear: year }),
      ...(name && { originalName: { contains: name, mode: 'insensitive' } }),
      ...(tags && {
        tags: {
          some: {
            name: { in: tags.split(',').map(t => t.trim()).filter(Boolean) },
          },
        },
      }),
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
          tags: true,
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

  async getTagsWithCount(skip = 0, take = 50) {
    const [tags, total] = await Promise.all([
      this.prisma.tag.findMany({
        skip,
        take,
        include: {
          _count: {
            select: { files: true },
          },
        },
        orderBy: {
          files: {
            _count: 'desc',
          },
        },
      }),
      this.prisma.tag.count(),
    ]);

    const data = tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      totalFiles: tag._count.files,
    }));

    return { data, total };
  }


  async getFilesByTags(tagName: string, params?: {
    skip?: number;
    take?: number;
    type?: FileType;
    year?: number;
    lang?: string;
  }) {
    const { skip = 0, take = 20, type, year, lang = 'hi' } = params || {};

    const where: Prisma.FileAssetWhereInput = {
      ...(type && { fileType: type }),
      ...(year && { contentYear: year }),
      tags: {
        some: {
          name: tagName,
        },
      },
    };

    const [files, total] = await Promise.all([
      this.prisma.fileAsset.findMany({
        where,
        include: {
          tags: true,
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

  async getFilesByCategory(
    categoryId: number,
    params?: {
      skip?: number;
      take?: number;
      type?: FileType;
      year?: number;
      lang?: string;
    },
  ) {
    const { skip = 0, take = 20, type, year, lang = 'hi' } = params || {};

    const where: Prisma.FileAssetWhereInput = {
      ...(type && { fileType: type }),
      ...(year && { contentYear: year }),
      OR: [
        { categoryId: categoryId },
        { contentType: { categoryId } }
      ]
    };

    const [files, total] = await Promise.all([
      this.prisma.fileAsset.findMany({
        where,
        include: {
          tags: true,
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
          tags: true,
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

    if (dto.languageCode && dto.displayName) {
      await this.prisma.fileTranslation.upsert({
        where: {
          fileId_languageCode: {
            fileId,
            languageCode: dto.languageCode,
          },
        },
        update: {
          displayName: dto.displayName,
          description: dto.description ?? null,
        },
        create: {
          fileId,
          languageCode: dto.languageCode,
          displayName: dto.displayName,
          description: dto.description ?? null,
        },
      });

      await this._recalculateSearchVector(fileId);
    }

    if (dto.parentId !== undefined || dto.contentTypeId !== undefined || dto.contentYear !== undefined) {
      await this.prisma.fileAsset.update({
        where: { id: fileId },
        data: {
          ...(dto.parentId !== undefined && { categoryId: dto.parentId }),
          ...(dto.contentTypeId !== undefined && { contentTypeId: dto.contentTypeId }),
          ...(dto.contentYear !== undefined && { contentYear: dto.contentYear }),
          updatedAt: new Date()
        }
      });
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

  private _generateAutomaticTags(fileData: any): string[] {
    let tags: string[] = [];

    // 1. Hashtags strictly from description
    if (fileData.description) {
      const match = fileData.description.match(/#[\w\u0900-\u097F]+/g);
      if (match) tags.push(...match.map((t: string) => t.slice(1).toLowerCase()));
    }

    // 2. Tokenize words from Event Name (e.g. "Shatabdi Utsav" -> "shatabdi", "utsav")
    if (fileData.eventName) {
      const words = fileData.eventName.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]+/g, ' ').split(' ');
      tags.push(...words);
    } // 3. Tokenize words strictly from the Original File Name ("RSS_Utsav_photo-2024.jpg" -> "rss", "utsav", "photo", "2024")
    if (fileData.originalName) {
      const nameWithoutExt = fileData.originalName.split('.')[0]; // remove extension
      const words = nameWithoutExt.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]+/g, ' ').split(' ');
      tags.push(...words);
    } // Pass whatever they explicitly sent in tags array
    if (fileData.tags && Array.isArray(fileData.tags)) {
      tags.push(...fileData.tags.map((t: string) => t.trim().toLowerCase()));
    } // Filter tiny fragments and deduplicate
    tags = tags.filter(t => t && t.length >= 3);
    return [...new Set(tags)];
  }

  async bulkCreate(dto: BulkCreateFilesDto) {
    const savedFiles = await Promise.all(
      dto.files.map(async (fileData) => {
        let tagConnects: Prisma.TagWhereUniqueInput[] = [];

        // Deeply Auto-extract tags from the Filename, Description, AND Event Name!
        const finalTags = this._generateAutomaticTags(fileData);

        if (finalTags.length > 0) {
          const allTags = await Promise.all(
            finalTags.map((tagName: string) =>
              this.prisma.tag.upsert({
                where: { name: tagName },
                update: {},
                create: { name: tagName }
              })
            )
          );
          tagConnects = allTags.map((t) => ({ id: t.id }));
        }

        const fileRecord = await this.prisma.fileAsset.create({
          data: {
            originalName: fileData.originalName || null,
            storageKey: fileData.storageKey,
            fileSize: fileData.fileSize,
            mimeType: fileData.mimeType,
            extension: fileData.mimeType.split('/').pop() || '',
            fileType: this.determineFileType(fileData.mimeType),

            eventName: fileData.eventName || null,
            contentYear: fileData.contentYear || null,
            contentTypeId: fileData.contentTypeId || null,
            categoryId: fileData.parentId,
            url: fileData.url || this.getPublicUrl(fileData.storageKey),

            ...(tagConnects.length > 0 && {
              tags: { connect: tagConnects }
            }),

            ...(fileData.displayName && fileData.languageCode && {
              translations: {
                create: [{
                  languageCode: fileData.languageCode,
                  displayName: fileData.displayName,
                  description: fileData.description || null
                }],
              }
            })
          },
          include: {
            tags: true,
          }
        });

        // Trigger full text search update
        this._recalculateSearchVector(fileRecord.id).catch();

        const { categoryId, ...rest } = fileRecord;
        return {
          ...rest,
          parentId: categoryId,
        };
      })
    );
    return savedFiles;
  }
}
