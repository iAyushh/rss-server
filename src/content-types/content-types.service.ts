import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContentTypeDto, UpdateContentTypeDto } from './dto';
import { I18nService } from 'nestjs-i18n';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { nanoid } from 'nanoid';
import { generateSlug } from '@Common';

@Injectable()
export class ContentTypeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) { }

  private async invalidateCache() {
    await this.cache.del('content-types:hi');
    await this.cache.del('content-types:en');
  }

  async create(dto: CreateContentTypeDto) {

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new BadRequestException('Invalid categoryId');
    }


    if (dto.subcategoryId) {
      const sub = await this.prisma.subcategory.findUnique({
        where: { id: dto.subcategoryId },
      });

      if (!sub || sub.categoryId !== dto.categoryId) {
        throw new BadRequestException(
          'Subcategory does not belong to category',
        );
      }
    }


    const content = await this.prisma.$transaction(async (tx) => {
      const english = dto.translations?.find(
        (t) => t.languageCode === 'en',
      );

      const slugSource = english?.name?.trim();

      let generatedSlug: string;

      if (slugSource) {
        generatedSlug = generateSlug(slugSource);

        if (!generatedSlug) {
          throw new BadRequestException(
            this.i18n.t('common.errors.INVALID_SLUG', { lang: 'en' }),
          );
        }
      } else {
        generatedSlug = `content-${nanoid(5)}`;
      }
      const contentYear = dto.contentYear ?? new Date().getFullYear();

      return tx.contentType.create({
        data: {
          slug: generatedSlug,

          categoryId: dto.categoryId,
          subcategoryId: dto.subcategoryId,
          contentYear,

          translations: {
            create: dto.translations,
          },

          metadata: dto.metadata
            ? {
              create: dto.metadata.map((m) => ({
                key: m.key,
                value: m.value,
              })),
            }
            : undefined,
        },

        include: {
          translations: true,
          metadata: true,
        },
      });
    });
    await this.prisma.$executeRaw`
UPDATE content_type ct
SET search_vector =
  to_tsvector(
    'simple',
    COALESCE(
      (SELECT string_agg(ctt.name, ' ')
       FROM content_type_translation ctt
       WHERE ctt.content_type_id = ct.id),
      ''
    )
  )
WHERE ct.id = ${content.id};
`;
    await this.invalidateCache();

    return content;
  }

  async findAll(
    lang: string,
    categoryId?: number,
    subcategoryId?: number,
    skip = 0,
    take = 10,
  ) {
    const cacheKey = `content-types:${lang}:${categoryId ?? 'all'}:${subcategoryId ?? 'all'}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const [contents, total] = await Promise.all([
      this.prisma.contentType.findMany({
        where: {
          categoryId: categoryId ?? undefined,
          subcategoryId: subcategoryId ?? undefined,
        },
        include: {
          translations: true,
          category: { select: { id: true, slug: true } },
          subcategory: { select: { id: true, slug: true } },
        },
        orderBy: [{ contentYear: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.contentType.count({
        where: {
          categoryId: categoryId ?? undefined,
          subcategoryId: subcategoryId ?? undefined,
        },
      }),
    ]);
    const result = contents
      .filter((content) => content.translations.length > 0)
      .map((content) => {
        const translation =
          content.translations.find((t) => t.languageCode === lang) ??
          (lang !== 'hi'
            ? content.translations.find((t) => t.languageCode === 'hi')
            : null) ??
          content.translations[0];

        return {
          id: content.id,
          categoryId: content.categoryId,
          subcategoryId: content.subcategoryId,
          categorySlug: content.category.slug,
          subcategorySlug: content.subcategory?.slug ?? null,
          contentYear: content.contentYear,
          lang: translation.languageCode,
          name: translation.name,
          description: translation.description,
          createdAt: content.createdAt,
        };
      });
    await this.cache.set(cacheKey, result, 300);
    return { data: result, total };
  }

  async getContentByYearSlug(
    year: number,
    categorySlug: string,
    contentSlug: string,
    lang: string,
  ) {
    const content = await this.prisma.contentType.findFirst({
      where: {
        slug: contentSlug,
        category: {
          slug: categorySlug,
        },
        files: {
          some: {
            contentYear: year,
          },
        },
      },
      include: {
        translations: true,
        category: true,
        subcategory: true,
        files: {
          where: {
            contentYear: year,
          },
          include: {
            translations: true,
            metadata: true,
          },
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });

    if (!content) {
      throw new NotFoundException('Content not found.');
    }

    const translation =
      content.translations.find((t) => t.languageCode === lang) ??
      (lang !== 'hi'
        ? content.translations.find((t) => t.languageCode === 'hi')
        : null) ??
      content.translations[0];

    return {
      id: content.id,
      slug: content.slug,
      contentYear: content.contentYear,
      categorySlug: content.category.slug,
      subcategorySlug: content.subcategory?.slug ?? null,
      name: translation.name,
      description: translation.description,
      files: content.files.map((f) => ({
        id: f.id,
        url: `${process.env.APP_URL}/uploads/${f.storageKey}`,
        fileType: f.fileType,
        uploadedAt: f.uploadedAt,
        displayName:
          f.translations.find((t) => t.languageCode === lang)?.displayName ??
          f.translations.find((t) => t.languageCode === 'hi')?.displayName ??
          f.translations[0]?.displayName ??
          f.originalName,
      })),
    };
  }

  async getIndexNavigation(lang: string) {
    const contents = await this.prisma.contentType.findMany({
      include: {
        translations: true,
        category: {
          include: {
            translations: true,
          },
        },
        subcategory: {
          include: {
            translations: true,
          },
        },
      },
      orderBy: [{ contentYear: 'desc' }, { createdAt: 'desc' }],
    });

    const result: Record<number, any> = {};

    for (const content of contents) {
      const year = content.contentYear;

      if (!result[year]) {
        result[year] = {
          year,
          categories: {},
        };
      }

      const category = content.category;
      const categoryTranslation =
        category.translations.find((t) => t.languageCode === lang) ??
        category.translations.find((t) => t.languageCode === 'hi') ??
        category.translations[0];

      if (!result[year].categories[category.slug]) {
        result[year].categories[category.slug] = {
          slug: category.slug,
          name: categoryTranslation.name,
          subcategories: {},
        };
      }

      const subcategory = content.subcategory;

      if (subcategory) {
        const subTranslation =
          subcategory.translations.find((t) => t.languageCode === lang) ??
          subcategory.translations.find((t) => t.languageCode === 'hi') ??
          subcategory.translations[0];

        if (
          !result[year].categories[category.slug].subcategories[
          subcategory.slug
          ]
        ) {
          result[year].categories[category.slug].subcategories[
            subcategory.slug
          ] = {
            slug: subcategory.slug,
            name: subTranslation.name,
            contents: [],
          };
        }

        const translation =
          content.translations.find((t) => t.languageCode === lang) ??
          content.translations.find((t) => t.languageCode === 'hi') ??
          content.translations[0];

        result[year].categories[category.slug].subcategories[
          subcategory.slug
        ].contents.push({
          slug: content.slug,
          name: translation.name,
        });
      }
    }

    return Object.values(result).map((yearBlock: any) => ({
      year: yearBlock.year,
      categories: Object.values(yearBlock.categories).map((cat: any) => ({
        slug: cat.slug,
        name: cat.name,
        subcategories: Object.values(cat.subcategories),
      })),
    }));
  }


  async update(id: number, dto: UpdateContentTypeDto, lang: string) {
    const exists = await this.prisma.contentType.findUnique({
      where: { id },
    });

    if (!exists) {
      throw new NotFoundException(
        this.i18n.t('common.errors.CONTENT_TYPE_NOT_FOUND', { lang }),
      );
    }

    await this.prisma.$transaction(async (tx) => {

      await tx.contentType.update({
        where: { id },
        data: {
          contentYear: dto.contentYear ?? undefined,
        },
      });

      if (dto.translations?.length) {
        await Promise.all(
          dto.translations.map((t) =>
            tx.contentTypeTranslation.upsert({
              where: {
                contentTypeId_languageCode: {
                  contentTypeId: id,
                  languageCode: t.languageCode,
                },
              },
              update: {
                name: t.name,
                description: t.description ?? null,
              },
              create: {
                contentTypeId: id,
                languageCode: t.languageCode,
                name: t.name,
                description: t.description ?? null,
              },
            }),
          ),
        );
      }
    });

    const newEnglish = dto.translations?.find(
      (t) => t.languageCode === 'en',
    );

    if (newEnglish?.name?.trim()) {
      const newSlugBase = generateSlug(newEnglish.name);

      if (newSlugBase) {
        let slug = newSlugBase;
        let counter = 0;

        while (true) {
          const exists = await this.prisma.contentType.findFirst({
            where: {
              slug,
              NOT: { id },
            },
          });

          if (!exists) break;

          counter++;
          slug = `${newSlugBase}-${counter}`;
        }

        await this.prisma.contentType.update({
          where: { id },
          data: { slug },
        });
      }
    }
    await this.prisma.$executeRaw`
UPDATE content_type ct
SET search_vector =
  to_tsvector(
    'simple',
    COALESCE(
      (SELECT string_agg(ctt.name, ' ')
       FROM content_type_translation ctt
       WHERE ctt.content_type_id = ct.id),
      ''
    )
  )
WHERE ct.id = ${id};
`;

    await this.invalidateCache();

    return {
      message: this.i18n.t('common.success.CONTENT_UPDATED', { lang }),
    };
  }


  async remove(id: number) {
    const content = await this.prisma.contentType.findUnique({
      where: { id },
    });

    if (!content) {
      throw new Error('ContentType not found');
    }

    await this.prisma.contentType.delete({ where: { id } });
    await this.invalidateCache();

    return {
      success: true,
      deletedId: id,
    };
  }
}
