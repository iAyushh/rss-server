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
  ) { }

  private async invalidateCache() {
    await this.cache.del('categories:hi');
    await this.cache.del('categories:en');
  }

  async create(dto: CreateCategoryRequestDto, lang: string) {
    const slugSource = dto.languageCode === 'en' ? dto.name.trim() : null;

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
        parentId: dto.parentId || null,
        level: dto.level || 1,
        translations: {
          create: [{
            languageCode: dto.languageCode,
            name: dto.name,
            description: dto.description || null,
          }],
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
  }

  async findAll(lang: string, skip = 0, take = 20) {
    const cacheKey = `categories:${lang}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

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
        parentId: cat.parentId,
        level: cat.level,
        lang: translation.languageCode,
        name: translation.name,
        description: translation.description,
      };
    });
    const result = { data, total };
    await this.cache.set(cacheKey, result, 600);
    return result;
  }

  async getChildren(parentId: number, lang: string, skip = 0, take = 20) {
    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where: { parentId },
        include: { translations: true },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.category.count({ where: { parentId } }),
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
        parentId: cat.parentId,
        level: cat.level,
        lang: translation.languageCode,
        name: translation.name,
        description: translation.description,
      };
    });
    return { data, total };
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

    if (dto.languageCode && dto.name) {
      await this.prisma.categoryTranslation.upsert({
        where: {
          categoryId_languageCode: {
            categoryId: id,
            languageCode: dto.languageCode,
          },
        },
        update: {
          name: dto.name,
          description: dto.description ?? null,
        },
        create: {
          categoryId: id,
          languageCode: dto.languageCode,
          name: dto.name,
          description: dto.description ?? null,
        },
      });
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

    // Geo-location Migration on Deletion
    const contentCount = await this.prisma.contentType.count({
      where: { categoryId: id },
    });

    const childrenCount = await this.prisma.category.count({
      where: { parentId: id },
    });

    if (contentCount > 0 || childrenCount > 0) {
      if (!category.parentId) {
        throw new BadRequestException(
          'Warning: This is a root category with nested content/areas. Please migrate the contents before deleting, or set a parent to automate migration.'
        );
      }

      // Migrate all children Categories to the parent to preserve hierarchy
      if (childrenCount > 0) {
        await this.prisma.category.updateMany({
          where: { parentId: id },
          data: { parentId: category.parentId, level: category.level },
        });
      }

      // Migrate all Content types tied to this category to the parent category
      if (contentCount > 0) {
        await this.prisma.contentType.updateMany({
          where: { categoryId: id },
          data: { categoryId: category.parentId },
        });
      }
    }

    await this.prisma.category.delete({ where: { id } });
    await this.invalidateCache();

    return {
      message: this.i18n.t('common.success.CATEGORY_DELETED', { lang }),
    };
  }
}
