import {
  BadRequestException,
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
import slugify from 'slugify';

@Injectable()
export class SubcategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

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
      slug = slugify(slugSource, {
        lower: true,
        trim: true,
      });
    } else {
      slug = `subcategory-${Date.now()}`;
    }

    if (!slug) {
      throw new BadRequestException(
        this.i18n.t('common.errors.INVALID_SLUG', { lang }),
      );
    }

    const exists = await this.prisma.subcategory.findFirst({
      where: {
        slug,
        categoryId: dto.categoryId,
      },
    });

    if (exists) {
      throw new BadRequestException(
        this.i18n.t('common.errors.SUBCATEGORY_ALREADY_EXISTS', { lang }),
      );
    }

    return this.prisma.subcategory.create({
      data: {
        slug,
        categoryId: dto.categoryId,
        translations: {
          create: dto.translations,
        },
      },
    });
  }

  async findByCategory(categoryId: number, lang: string) {
    const subcategories = await this.prisma.subcategory.findMany({
      where: { categoryId },
      include: {
        translations: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return subcategories.map((sub) => {
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

    await this.prisma.$transaction(async (tx) => {
      if (dto.translations?.length) {
        // optional: remove translations not sent anymore
        await tx.subcategoryTranslation.deleteMany({
          where: {
            subcategoryId: id,
            languageCode: {
              notIn: dto.translations.map((t) => t.languageCode),
            },
          },
        });

        // upsert translations
        await Promise.all(
          dto.translations.map((t) =>
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
      }
    });

    return {
      message: this.i18n.t('common.success.SUBCATEGORY_UPDATED', { lang }),
    };
  }

  // REMOVE
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

    return {
      message: this.i18n.t('common.success.SUBCATEGORY_DELETED', { lang }),
    };
  }
}
