import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
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
  ) { }


  private async invalidateCache() {
    const version =
      (await this.cache.get<number>('subcategories:version')) || 1;


    await this.cache.set('subcategories:version', version + 1, 0);
  }


  async create(dto: CreateSubcategoryRequestDto, lang: string) {
    let level = 0;
    let parentId: number | null = null;
    let categoryId = dto.categoryId;



    if (dto.parentId) {
      const parent = await this.prisma.subcategory.findUnique({
        where: { id: dto.parentId },
      });


      if (!parent) {
        throw new NotFoundException(
          this.i18n.t('common.errors.SUBCATEGORY_NOT_FOUND', { lang }),
        );
      }



      if (parent.level >= 4) {
        throw new BadRequestException('Maximum 5 levels allowed');
      }


      level = parent.level + 1;
      parentId = parent.id;
      categoryId = parent.categoryId; // inherit
    }



    else {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });


      if (!category) {
        throw new NotFoundException(
          this.i18n.t('common.errors.CATEGORY_NOT_FOUND', { lang }),
        );
      }
    }



    const english = dto.translations.find((t) => t.languageCode === 'en');
    const slugSource = english?.name?.trim();


    const slug = slugSource
      ? generateSlug(slugSource)
      : `subcategory-${nanoid(5)}`;


    const subcategory = await this.prisma.subcategory.create({
      data: {
        slug,
        categoryId,
        parentId,
        level,
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


    await this.invalidateCache();


    return subcategory;
  }


  async getByCategory(
    categoryId: number,
    lang = 'hi',
    skip = 0,
    take = 10,
  ) {
    const version =
      (await this.cache.get<number>('subcategories:version')) || 1;

    const cacheKey = `subcategories:${version}:category:${categoryId}:${lang}:${skip}:${take}`;

    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const languages = lang === 'hi' ? ['hi', 'en'] : [lang, 'hi'];

    const [subcategories, total] = await Promise.all([
      this.prisma.subcategory.findMany({
        where: {
          categoryId,
          level: 0,
        },
        include: {
          translations: {
            where: {
              languageCode: { in: languages },
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
      this.prisma.subcategory.count({
        where: { categoryId, level: 0 },
      }),
    ]);

    const result = subcategories.map((sub) => {
      const t =
        sub.translations.find((x) => x.languageCode === lang) ??
        sub.translations.find((x) => x.languageCode === 'hi') ??
        sub.translations.find((x) => x.languageCode === 'en') ??
        sub.translations[0];

      return {
        id: sub.id,
        slug: sub.slug,
        categoryId: sub.categoryId,
        parentId: sub.parentId,
        level: sub.level,
        lang: t?.languageCode || lang,
        name: t?.name || '',
        description: t?.description || null,
      };
    });

    const finalResult = { data: result, total, skip, take };

    await this.cache.set(cacheKey, finalResult, 600);

    return finalResult;
  }


  async getSubcategory(
    id: number,
    lang = 'hi',
  ) {
    const languages = lang === 'hi' ? ['hi', 'en'] : [lang, 'hi'];

    const subcategory = await this.prisma.subcategory.findUnique({
      where: { id },
      include: {
        translations: {
          where: {
            languageCode: { in: languages },
          },
        },
      },
    });

    if (!subcategory) {
      throw new NotFoundException(
        this.i18n.t('common.errors.SUBCATEGORY_NOT_FOUND', { lang }),
      );
    }

    const translation =
      subcategory.translations.find((t) => t.languageCode === lang) ??
      subcategory.translations.find((t) => t.languageCode === 'hi') ??
      subcategory.translations.find((t) => t.languageCode === 'en') ??
      subcategory.translations[0];

    return {
      id: subcategory.id,
      slug: subcategory.slug,
      categoryId: subcategory.categoryId,
      parentId: subcategory.parentId,
      level: subcategory.level,
      lang: translation?.languageCode || lang,
      name: translation?.name || '',
      description: translation?.description || null,
      createdAt: subcategory.createdAt,
    };
  }

  async getOne(id: number, lang = 'hi') {
    const version =
      (await this.cache.get<number>('subcategories:version')) || 1;

    const cacheKey = `subcategory:${version}:${id}:${lang}`;

    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const languages = lang === 'hi' ? ['hi', 'en'] : [lang, 'hi'];

    const subcategory = await this.prisma.subcategory.findUnique({
      where: { id },
      include: {
        translations: {
          where: {
            languageCode: { in: languages },
          },
        },
      },
    });

    if (!subcategory) {
      throw new NotFoundException(
        this.i18n.t('common.errors.SUBCATEGORY_NOT_FOUND', { lang }),
      );
    }

    const t =
      subcategory.translations.find((x) => x.languageCode === lang) ??
      subcategory.translations.find((x) => x.languageCode === 'hi') ??
      subcategory.translations.find((x) => x.languageCode === 'en') ??
      subcategory.translations[0];

    const result = {
      id: subcategory.id,
      slug: subcategory.slug,
      categoryId: subcategory.categoryId,
      parentId: subcategory.parentId,
      level: subcategory.level,
      lang: t?.languageCode || lang,
      name: t?.name || '',
      description: t?.description || null,
      createdAt: subcategory.createdAt,
    };

    await this.cache.set(cacheKey, result, 600);

    return result;
  }

  async getChildren(
    parentId: number,
    lang = 'hi',
    skip = 0,
    take = 10,
  ) {
    const version =
      (await this.cache.get<number>('subcategories:version')) || 1;

    const cacheKey = `subcategories:${version}:children:${parentId}:${lang}:${skip}:${take}`;

    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const languages = lang === 'hi' ? ['hi', 'en'] : [lang, 'hi'];

    const [subcategories, total] = await Promise.all([
      this.prisma.subcategory.findMany({
        where: {
          parentId,
        },
        include: {
          translations: {
            where: {
              languageCode: { in: languages },
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
      this.prisma.subcategory.count({
        where: { parentId },
      }),
    ]);

    const result = subcategories.map((sub) => {
      const t =
        sub.translations.find((x) => x.languageCode === lang) ??
        sub.translations.find((x) => x.languageCode === 'hi') ??
        sub.translations.find((x) => x.languageCode === 'en') ??
        sub.translations[0];

      return {
        id: sub.id,
        slug: sub.slug,
        categoryId: sub.categoryId,
        parentId: sub.parentId,
        level: sub.level,
        lang: t?.languageCode || lang,
        name: t?.name || '',
        description: t?.description || null,
      };
    });

    const finalResult = { data: result, total, skip, take };

    await this.cache.set(cacheKey, finalResult, 600);

    return finalResult;
  }

  async getSubcategoryData(subcategoryId: number, lang = 'hi') {
    const languages = lang === 'hi' ? ['hi', 'en'] : [lang, 'hi'];

    const resolveTranslation = (translations: any[]) =>
      translations.find((t) => t.languageCode === lang) ||
      translations.find((t) => t.languageCode === 'hi') ||
      translations.find((t) => t.languageCode === 'en') ||
      translations[0];


    const files = await this.prisma.fileAsset.findMany({
      where: {
        metadata: {
          some: {
            key: 'subcategoryId',
            value: String(subcategoryId),
          },
        },
      },
      include: {
        translations: true,
      },
      orderBy: { createdAt: 'desc' },
    });


    const children = await this.prisma.subcategory.findMany({
      where: {
        parentId: subcategoryId,
      },
      include: {
        translations: {
          where: {
            languageCode: { in: languages },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });


    const formattedFiles = files.map((file) => {
      const t = resolveTranslation(file.translations || []);
      return {
        type: 'file',
        id: file.id,
        name: t?.displayName || file.originalName,
        url: file.url,
        fileType: file.fileType,
        createdAt: file.createdAt,
      };
    });


    const formattedChildren = children.map((child) => {
      const t = resolveTranslation(child.translations);
      return {
        type: 'subcategory',
        id: child.id,
        level: child.level,
        parentId: child.parentId,
        name: t?.name || '',
        description: t?.description || null,
      };
    });


    return {
      subcategoryId,
      data: [...formattedChildren, ...formattedFiles],
    };
  }

  async findByCategory(
    categoryId: number,
    subcategoryId?: number,
    lang = 'hi',
    skip = 0,
    take = 10,
  ) {
    const version =
      (await this.cache.get<number>('subcategories:version')) || 1;


    const cacheKey = `subcategories:${version}:${categoryId}:${lang}:${skip}:${take}`;


    const cached = await this.cache.get<{ result: any[]; total: number }>(
      cacheKey,
    );
    if (cached) return cached;


    const languages = lang === 'hi' ? ['hi', 'en'] : [lang, 'hi'];
    const [subcategories, total] = await Promise.all([
      this.prisma.subcategory.findMany({
        where: {
          categoryId,
          level: 0,
          parentId: subcategoryId ? subcategoryId : undefined,
        },
        include: {
          translations: {
            where: {
              languageCode: {
                in: languages,
              },
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
      this.prisma.subcategory.count({
        where: { categoryId },
      }),
    ]);


    const result = subcategories.map((sub) => {
      const translation =
        sub.translations.find((t) => t.languageCode === lang) ??
        sub.translations.find((t) => t.languageCode === 'hi') ??
        sub.translations.find((t) => t.languageCode === 'en') ??
        sub.translations[0];


      return {
        id: sub.id,
        slug: sub.slug,
        categoryId: sub.categoryId,
        lang: translation?.languageCode || lang,
        name: translation?.name || '',
        description: translation?.description || null,
      };
    });


    const finalResult = { result, total };


    await this.cache.set(cacheKey, finalResult, 600);


    return finalResult;
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


    await this.invalidateCache();


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


    await this.invalidateCache();


    return {
      message: this.i18n.t('common.success.SUBCATEGORY_DELETED', { lang }),
    };
  }
}



