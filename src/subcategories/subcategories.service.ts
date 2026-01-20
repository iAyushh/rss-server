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

@Injectable()
export class SubcategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async create(dto: CreateSubcategoryRequestDto, lang: string) {
    const hindiTranslation = dto.translations?.find(
      (t) => t.languageCode === 'hi',
    );

    // if (!hindiTranslation || !hindiTranslation.name?.trim()) {
    //   throw new BadRequestException(
    //     this.i18n.t('common.errors.HINDI_NAME_REQUIRED', { lang }),
    //   );
    // }

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException(
        this.i18n.t('common.errors.CATEGORY_NOT_FOUND', { lang }),
      );
    }

    const exists = await this.prisma.subcategory.findUnique({
      where: {
        categoryId_slug: {
          categoryId: dto.categoryId,
          slug: dto.slug,
        },
      },
    });

    if (exists) {
      throw new BadRequestException(
        this.i18n.t('common.errors.SUBCATEGORY_ALREADY_EXISTS', { lang }),
      );
    }

    return this.prisma.subcategory.create({
      data: {
        slug: dto.slug,
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
        translations: {
          where: {
            languageCode: { in: [lang, 'hi'] },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return subcategories.map((sub) => {
      const translation =
        sub.translations.find(
          (t: SubcategoryTranslation) => t.languageCode === lang,
        ) ??
        sub.translations.find(
          (t: SubcategoryTranslation) => t.languageCode === 'hi',
        );

      return {
        id: sub.id,
        slug: sub.slug,
        name: translation?.name ?? null,
        description: translation?.description ?? null,
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

    if (dto.translations) {
      const hindi = dto.translations.find((t) => t.languageCode === 'hi');

      // if (!hindi || !hindi.name || !hindi.name.trim()) {
      //   throw new BadRequestException(
      //     this.i18n.t('common.errors.HINDI_TRANSLATION_REQUIRED', { lang }),
      //   );
      // }

      await this.prisma.subcategoryTranslation.deleteMany({
        where: {
          subcategoryId: id,
          languageCode: {
            in: dto.translations.map((t) => t.languageCode),
          },
        },
      });

      await this.prisma.subcategoryTranslation.createMany({
        data: dto.translations.map((t) => ({
          ...t,
          subcategoryId: id,
        })),
      });
    }

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

    await this.prisma.subcategory.delete({ where: { id } });

    return {
      message: this.i18n.t('common.success.SUBCATEGORY_DELETED', { lang }),
    };
  }
}
