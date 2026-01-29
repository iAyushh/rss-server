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
import slugify from 'slugify';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  private async invalidateCache() {
    await this.cache.del('categories:hi');
    await this.cache.del('categories:en');
  }

  async create(dto: CreateCategoryRequestDto, lang: string) {
    const english = dto.translations.find((t) => t.languageCode === 'en');
    // const hindi = dto.translations.find((t) => t.languageCode === 'hi');

    const slugSource = english?.name?.trim();

    let slug: string;

    if (slugSource) {
      slug = slugify(slugSource, {
        lower: true,
        trim: true,
      });
    } else {
      slug = `category-${Date.now()}`;
    }

    if (!slug) {
      throw new BadRequestException(
        this.i18n.t('common.errors.INVALID_SLUG', { lang }),
      );
    }

    const exists = await this.prisma.category.findUnique({ where: { slug } });
    if (exists) {
      throw new BadRequestException(
        this.i18n.t('common.errors.CATEGORY_ALREADY_EXISTS', { lang }),
      );
    }

    const category = await this.prisma.category.create({
      data: {
        slug,
        translations: {
          create: dto.translations,
        },
      },
    });

    await this.invalidateCache();
    return category;
  }
  async findAll(lang: string) {
    const cacheKey = `categories:${lang}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const categories = await this.prisma.category.findMany({
      include: {
        translations: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const result = categories.map((cat) => {
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
    await this.cache.set(cacheKey, result, 600);
    return result;
  }

  async update(id: number, dto: UpdateCategoryRequestDto, lang: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(
        this.i18n.t('common.errors.CATEGORY_NOT_FOUND', { lang }),
      );
    }

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
