import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { SubcategoryTranslation } from '@prisma/client';
import {
  CreateSubcategoryRequestDto,
  UpdateSubcategoryRequestDto,
} from './dto';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { nanoid } from 'nanoid';
import { generateSlug } from '@Common';

@Injectable()
export class SubcategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  private async invalidateCache(categoryId: number) {
    await this.cache.del(`subcategories:${categoryId}:hi`);
    await this.cache.del(`subcategories:${categoryId}:en`);
  }

  async create(dto: CreateSubcategoryRequestDto, lang: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException(
        this.i18n.t('common.errors.CATEGORY_NOT_FOUND', { lang }),
      );
    }

    const english = dto.translations.find((t) => t.languageCode === 'en');
    const slugSource = english?.name?.trim();

    let slug: string;

    if (slugSource) {
      slug = generateSlug(slugSource);

      if (!slug) {
        throw new BadRequestException(
          this.i18n.t('common.errors.INVALID_SLUG', { lang }),
        );
      }

      for (const t of dto.translations) {
        const normalizedName = t.name.trim().normalize('NFC');

        const exists = await this.prisma.categoryTranslation.findFirst({
          where: {
            name: {
              equals: normalizedName,
              mode: 'insensitive',
            },
            languageCode: t.languageCode,
          },
        });

        if (exists) {
          throw new BadRequestException(
            this.i18n.t('common.errors.CATEGORY_ALREADY_EXISTS', { lang }),
          );
        }
      }
    } else {
      slug = `subcategory-${nanoid(5)}`;
    }

    const subcategory = await this.prisma.subcategory.create({
      data: {
        slug,
        categoryId: dto.categoryId,
        translations: {
          create: dto.translations,
        },
      },
    });

    await this.prisma.$executeRaw`
UPDATE subcategory s
SET search_vector =
  to_tsvector(
    'simple',
    COALESCE(
      (SELECT string_agg(st.name, ' ')
       FROM subcategory_translation st
       WHERE st.subcategory_id = s.id),
      ''
    )
  )
WHERE s.id = ${subcategory.id};
`;

    await this.invalidateCache(dto.categoryId);
    return subcategory;
  }

  async findByCategory(categoryId: number, lang: string, skip = 0, take = 10) {
    const cacheKey = `subcategories:${categoryId}:${lang}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const [subcategories, total] = await Promise.all([
      this.prisma.subcategory.findMany({
        where: { categoryId },
        include: { translations: true },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.subcategory.count({
        where: { categoryId },
      }),
    ]);

    const result = subcategories.map((sub) => {
      let translation = sub.translations.find(
        (t: SubcategoryTranslation) => t.languageCode === lang,
      );

      if (!translation && lang !== 'hi') {
        translation = sub.translations.find(
          (t: SubcategoryTranslation) => t.languageCode === 'hi',
        );
      }

      if (!translation) {
        translation = sub.translations[0];
      }

      return {
        id: sub.id,
        slug: sub.slug,
        categoryId: sub.categoryId,
        lang: translation.languageCode,
        name: translation.name,
        description: translation.description,
      };
    });
    await this.cache.set(cacheKey, result, 600 * 1000);
    return { result, total };
  }

  async update(id: number, dto: UpdateSubcategoryRequestDto, lang: string) {
    const subcategory = await this.prisma.subcategory.findUnique({
      where: { id },
    });

    if (!subcategory) {
      throw new NotFoundException(
        this.i18n.t('common.errors.SUBCATEGORY_NOT_FOUND', { lang }),
      );
    }

    const translations = dto.translations;

    if (translations && translations.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await Promise.all(
          translations.map((t) =>
            tx.subcategoryTranslation.upsert({
              where: {
                subcategoryId_languageCode: {
                  subcategoryId: id,
                  languageCode: t.languageCode,
                },
              },
              update: {
                name: t.name,
                description: t.description ?? null,
              },
              create: {
                subcategoryId: id,
                languageCode: t.languageCode,
                name: t.name,
                description: t.description ?? null,
              },
            }),
          ),
        );
      });
    }
    const newEnglish = dto.translations?.find((t) => t.languageCode === 'en');

    if (newEnglish?.name?.trim()) {
      const newSlugBase = generateSlug(newEnglish.name);

      if (newSlugBase) {
        let slug = newSlugBase;
        let counter = 0;

        while (true) {
          const exists = await this.prisma.subcategory.findFirst({
            where: {
              slug,
              NOT: { id },
            },
          });

          if (!exists) break;

          counter++;
          slug = `${newSlugBase}-${counter}`;
        }

        await this.prisma.subcategory.update({
          where: { id },
          data: { slug },
        });
      }
    }
    await this.prisma.$executeRaw`
UPDATE subcategory s
SET search_vector =
  to_tsvector(
    'simple',
    COALESCE(
      (SELECT string_agg(st.name, ' ')
       FROM subcategory_translation st
       WHERE st.subcategory_id = s.id),
      ''
    )
  )
WHERE s.id = ${id};
`;

    await this.invalidateCache(subcategory.categoryId);

    return {
      message: this.i18n.t('common.success.SUBCATEGORY_UPDATED', { lang }),
    };
  }

  async remove(id: number, lang: string) {
    const subcategory = await this.prisma.subcategory.findUnique({
      where: { id },
    });

    if (!subcategory) {
      throw new NotFoundException(
        this.i18n.t('common.errors.SUBCATEGORY_NOT_FOUND', { lang }),
      );
    }

    await this.prisma.subcategory.delete({
      where: { id },
    });

    await this.invalidateCache(subcategory.categoryId);

    return {
      message: this.i18n.t('common.success.SUBCATEGORY_DELETED', { lang }),
    };
  }
}
