import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CategoryTranslation } from '@prisma/client';
import { CreateCategoryRequestDto, UpdateCategoryRequestDto } from './dto';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { generateSlug } from '@Common';
import { nanoid } from 'nanoid';

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) { }

  private async invalidateCache() {
    const currentVersion =
      (await this.cache.get<number>('categories:version')) ?? 1;

    await this.cache.set('categories:version', currentVersion + 1);
  }

  async create(dto: CreateCategoryRequestDto, lang: string) {

    const english = dto.translations.find((t) => t.languageCode === 'en');
    // const hindi = dto.translations.find((t) => t.languageCode === 'hi');


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

    }

    else {
      slug = `category-${nanoid(5)}`;
    }
    try {

      const category = await this.prisma.category.create({
        data: {
          slug,
          translations: {
            create: dto.translations.map((t) => ({
              ...t,
              name: t.name.trim().normalize('NFC'),
            }))
          },
        },
      });



      await this.prisma.$executeRaw`
    UPDATE category c
    SET search_vector =
      to_tsvector(
        'simple',
        COALESCE(
          (SELECT string_agg(ct.name, ' ')
           FROM category_translation ct
           WHERE ct.category_id = c.id),
          ''
        )
      )
    WHERE c.id = ${category.id};
  `;

      await this.invalidateCache();
      return category;

    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException(
          this.i18n.t('common.errors.CATEGORY_ALREADY_EXISTS', { lang }),
        );
      }
      throw error;
    }
  }

  async findAll(lang: string, skip = 0, take = 20) {
    const version =
      (await this.cache.get<number>('categories:version')) ?? 1;

    const cacheKey = `categories:${version}:${lang}:${skip}:${take}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        include: { translations: true },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.category.count(),
    ]);

    const data = categories.map((cat) => {
      let translation = cat.translations.find(
        (t: CategoryTranslation) => t.languageCode === lang,
      );

      if (!translation && lang !== 'hi') {
        translation = cat.translations.find(
          (t: CategoryTranslation) => t.languageCode === 'hi',
        );
      }

      if (!translation) {
        translation = cat.translations[0];
      }

      return {
        id: cat.id,
        slug: cat.slug,
        lang: translation.languageCode,
        name: translation.name,
        description: translation.description,
      };
    });

    const result = { data, total };

    await this.cache.set(cacheKey, result, 600 * 1000);

    return result;
  }

  async update(id: number, dto: UpdateCategoryRequestDto, lang: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { translations: true }
    });

    if (!category) {
      throw new NotFoundException(
        this.i18n.t('common.errors.CATEGORY_NOT_FOUND', { lang }),
      );
    }

    const oldEnglish = category.translations.find(
      (t) => t.languageCode === 'en',
    );

    if (dto.translations?.length) {
      await this.prisma.$transaction(
        dto.translations.map((t) =>
          this.prisma.categoryTranslation.upsert({
            where: {
              categoryId_languageCode: {
                categoryId: id,
                languageCode: t.languageCode,
              },
            },
            update: {
              name: t.name,
              description: t.description ?? null,
            },
            create: {
              categoryId: id,
              languageCode: t.languageCode,
              name: t.name,
              description: t.description ?? null,
            },
          }),
        ),
      );
    }

    const newEnglish = dto.translations?.find(
      (t) => t.languageCode === 'en',
    );

    if (newEnglish?.name?.trim()) {
      const newSlugBase = generateSlug(newEnglish.name);

      if (newSlugBase) {
        let slug = newSlugBase;
        let counter = 0;

        while (true) {
          const exists = await this.prisma.category.findFirst({
            where: {
              slug,
              NOT: { id },
            },
          });

          if (!exists) break;

          counter++;
          slug = `${newSlugBase}-${counter}`;
        }

        await this.prisma.category.update({
          where: { id },
          data: { slug },
        });
      }
    }


    await this.prisma.$executeRaw`
  UPDATE category c
  SET search_vector =
    to_tsvector(
      'simple',
      COALESCE(
        (SELECT string_agg(ct.name, ' ')
         FROM category_translation ct
         WHERE ct.category_id = c.id),
        ''
      )
    )
  WHERE c.id = ${id};
  `;

    await this.invalidateCache();

    return {
      message: this.i18n.t('common.success.CATEGORY_UPDATED', { lang }),
    };
  }

  async remove(id: number, lang: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(
        this.i18n.t('common.errors.CATEGORY_NOT_FOUND', { lang }),
      );
    }

    const subCount = await this.prisma.subcategory.count({
      where: { categoryId: id },
    });

    if (subCount > 0) {
      throw new BadRequestException(
        this.i18n.t('common.errors.CATEGORY_HAS_SUBCATEGORIES', { lang }),
      );
    }

    const contentCount = await this.prisma.contentType.count({
      where: {
        categoryId: id,
      },
    });
    if (contentCount > 0) {
      throw new BadRequestException(
        'Warning: category has content types remove them first',
      );
    }

    await this.prisma.category.delete({ where: { id } });

    await this.invalidateCache();

    return {
      message: this.i18n.t('common.success.CATEGORY_DELETED', { lang }),
    };
  }
}
