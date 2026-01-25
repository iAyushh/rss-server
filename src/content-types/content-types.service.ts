import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContentTypeDto, UpdateContentTypeDto } from './dto';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class ContentTypeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async create(dto: CreateContentTypeDto) {
    // 1. Validate category exists
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new BadRequestException('Invalid categoryId');
    }

    // 2. Validate subcategory (if provided)
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

    // 3. Transactional create
    return this.prisma.$transaction(async (tx) => {
      return tx.contentType.create({
        data: {
          categoryId: dto.categoryId,
          subcategoryId: dto.subcategoryId,
          contentYear: dto.contentYear,
          translations: {
            create: dto.translations,
          },
        },
        include: {
          translations: true,
        },
      });
    });
  }

  async findAll(lang: string) {
    const contents = await this.prisma.contentType.findMany({
      include: {
        translations: true,
        category: {
          select: {
            id: true,
            slug: true,
          },
        },
        subcategory: {
          select: {
            id: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return contents
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
          status: content.status,
          lang: translation.languageCode,
          name: translation.name,
          description: translation.description,
          createdAt: content.createdAt,
        };
      });
  }

  //Update
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
          contentYear: dto.contentYear,
          status: dto.status,
        },
      });

      if (dto.translations?.length) {
        // optional cleanup
        await tx.contentTypeTranslation.deleteMany({
          where: {
            contentTypeId: id,
            languageCode: {
              notIn: dto.translations.map((t) => t.languageCode),
            },
          },
        });

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

    return {
      message: this.i18n.t('common.success.CONTENT_UPDATED', { lang }),
    };
  }

  //Delete content
  async remove(id: number) {
    const content = await this.prisma.contentType.findUnique({
      where: { id },
    });

    if (!content) {
      throw new Error('ContentType not found');
    }

    await this.prisma.contentType.delete({ where: { id } });

    return {
      success: true,
      deletedId: id,
    };
  }
}
