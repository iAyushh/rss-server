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
      orderBy: { createdAt: 'desc' },
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

    if (dto.translations) {
      // const hindi = dto.translations.find((t) => t.languageCode === 'hi');

      // if (!hindi || !hindi.name || !hindi.name.trim()) {
      //   throw new BadRequestException(
      //     this.i18n.t('common.errors.HINDI_TRANSLATION_REQUIRED', { lang }),
      //   );
      // }

      await this.prisma.categoryTranslation.deleteMany({
        where: {
          categoryId: id,
          languageCode: {
            in: dto.translations.map((t) => t.languageCode),
          },
        },
      });

      await this.prisma.categoryTranslation.createMany({
        data: dto.translations.map((t) => ({
          ...t,
          categoryId: id,
        })),
      });
    }

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
