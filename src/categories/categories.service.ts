import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CategoryTranslation } from '@prisma/client';
import { CreateCategoryRequestDto, UpdateCategoryRequestDto } from './dto';
import slugify from 'slugify';

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

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

    return this.prisma.category.create({
      data: {
        slug,
        translations: {
          create: dto.translations,
        },
      },
    });
  }
  async findAll(lang: string) {
    const categories = await this.prisma.category.findMany({
      include: {
        translations: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return categories.map((cat) => {
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

    await this.prisma.$transaction(async (tx) => {
      if (dto.translations?.length) {
        // optional: remove translations that are no longer sent
        await tx.categoryTranslation.deleteMany({
          where: {
            categoryId: id,
            languageCode: {
              notIn: dto.translations.map((t) => t.languageCode),
            },
          },
        });

        // upsert translations
        await Promise.all(
          dto.translations.map((t) =>
            tx.categoryTranslation.upsert({
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
    });

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

    await this.prisma.category.delete({ where: { id } });

    return {
      message: this.i18n.t('common.success.CATEGORY_DELETED', { lang }),
    };
  }
}
