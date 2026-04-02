import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) { }

  private parseSearchQuery(query: string) {
    const tokens = query.trim().split(/\s+/);

    let year: number | undefined;
    const keywords: string[] = [];

    for (const token of tokens) {
      if (/^\d{4}$/.test(token)) {
        year = Number(token);
      } else {
        keywords.push(token);
      }
    }

    return {
      year,
      keyword: keywords.join(' '),
    };
  }

  async globalSearch(
    query: string,
    languageCode: string,
    skip = 0,
    take = 20,
    year?: number,
  ) {
    if ((!query || !query.trim()) && !year) {
      return [];
    }

    const parsed = this.parseSearchQuery(query);

    const trimmed = query?.trim() ?? '';
    const isNumeric = /^\d+$/.test(trimmed);

    let yearLike: string | null = null;

    if (isNumeric) {
      yearLike = `%${trimmed}%`;
    }

    const searchTerm = isNumeric ? null : parsed.keyword || null;

    if (!searchTerm && !yearLike && !parsed.year) {
      return [];
    }

    return this.prisma.$queryRaw(
      Prisma.sql`

SELECT * FROM (


SELECT
  'category' AS type,
  c.id,
  c.slug,
  NULL::int AS year,
  (
    SELECT name
    FROM category_translation
    WHERE category_id = c.id
    ORDER BY 
      (language_code = ${languageCode}) DESC,
      (language_code = 'en') DESC,
      (language_code = 'hi') DESC
    LIMIT 1
  ) AS title,
  ts_rank(
    COALESCE(c.search_vector,''),
    to_tsquery('simple', (${searchTerm})::text || ':*')
  ) AS rank
FROM category c
WHERE
(${searchTerm})::text IS NOT NULL
AND c.search_vector @@ to_tsquery('simple', (${searchTerm})::text || ':*')

UNION ALL


SELECT
  'subcategory' AS type,
  s.id,
  s.slug,
  NULL::int AS year,
  (
    SELECT name
    FROM subcategory_translation
    WHERE subcategory_id = s.id
    ORDER BY 
      (language_code = ${languageCode}) DESC,
      (language_code = 'en') DESC,
      (language_code = 'hi') DESC
    LIMIT 1
  ) AS title,
  ts_rank(
    COALESCE(s.search_vector,''),
    to_tsquery('simple', (${searchTerm})::text || ':*')
  ) AS rank
FROM subcategory s
WHERE
(${searchTerm})::text IS NOT NULL
AND s.search_vector @@ to_tsquery('simple', (${searchTerm})::text || ':*')

UNION ALL


SELECT
  'content' AS type,
  ct.id,
  ct.slug,
  NULL::int AS year, 
  (
    SELECT name
    FROM content_type_translation
    WHERE content_type_id = ct.id
    ORDER BY 
      (language_code = ${languageCode}) DESC,
      (language_code = 'en') DESC,
      (language_code = 'hi') DESC
    LIMIT 1
  ) AS title,
  ts_rank(
    COALESCE(ct.search_vector,''),
    to_tsquery('simple', (${searchTerm})::text || ':*')
  ) AS rank
FROM content_type ct
WHERE
(
  (${yearLike})::text IS NULL
  OR EXISTS (
    SELECT 1
    FROM file_asset f2
    WHERE f2.content_type_id = ct.id
    AND f2.content_year::text LIKE ${yearLike}
  )
)
AND (
  (${searchTerm})::text IS NULL
  OR ct.search_vector @@ to_tsquery('simple', (${searchTerm})::text || ':*')
)

UNION ALL


SELECT
  'file' AS type,
  f.id,
  NULL::text AS slug,
  f.content_year AS year,
  (
    SELECT "displayName"
    FROM file_translation
    WHERE file_id = f.id
    ORDER BY 
      (language_code = ${languageCode}) DESC,
      (language_code = 'en') DESC,
      (language_code = 'hi') DESC
    LIMIT 1
  ) AS title,
  ts_rank(
    COALESCE(f.search_vector,''),
    to_tsquery('simple', (${searchTerm})::text || ':*')
  ) AS rank
FROM file_asset f
WHERE
(
  (${yearLike})::text IS NULL
  OR f.content_year::text LIKE ${yearLike}
)
AND (
  (${searchTerm})::text IS NULL
  OR f.search_vector @@ to_tsquery('simple', (${searchTerm})::text || ':*')
)

) results

ORDER BY year DESC NULLS LAST, rank DESC
LIMIT ${take} OFFSET ${skip}
`,
    );
  }



async searchFiles(
  search?: string,
  languageCode?: string,
  skip = 0,
  take = 20,
  year?: number,
  sortBy?: 'updatedAt' | 'fileSize' | 'originalName' | 'name',
  order?: 'asc' | 'desc',
) {
  const lang = languageCode || 'hi';

  const sortFieldMap = {
    updatedAt: 'createdAt',
    fileSize: 'fileSize',
    originalName: 'originalName',
  } as const;

  const isStringSort =
    sortBy === 'originalName' || sortBy === 'name';

  const orderBy: Prisma.FileAssetOrderByWithRelationInput =
    sortBy && !isStringSort
      ? { [sortFieldMap[sortBy]]: (order ?? 'desc') as Prisma.SortOrder }
      : { createdAt: 'desc' };

  const select = {
    id: true,
    originalName: true,
    fileType: true,
    fileSize: true,
    url: true,
    contentYear: true,
    createdAt: true,
    translations: true,
    contentType: {
      select: {
        translations: true,
        category: { select: { translations: true } },
        subcategory: { select: { translations: true } },
      },
    },
  };

  const baseWhere: any = {
    ...(year && { contentYear: year }),
  };

  let files = await this.prisma.fileAsset.findMany({
    where: {
      ...baseWhere,
      ...(search && {
        translations: {
          some: {
            displayName: {
              contains: search,
              mode: 'insensitive',
            },
            languageCode: lang,
          },
        },
      }),
    },
    select,
    orderBy: isStringSort ? undefined : orderBy,
    skip: isStringSort ? 0 : skip,
    take: isStringSort ? 5000 : take,
  });

  if (search && files.length === 0) {
    files = await this.prisma.fileAsset.findMany({
      where: {
        ...baseWhere,
        translations: {
          some: {
            displayName: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      },
      select,
      orderBy: isStringSort ? undefined : orderBy,
      skip: isStringSort ? 0 : skip,
      take: isStringSort ? 5000 : take,
    });
  }

  const pick = (arr: any[]) =>
    arr.find((t) => t.languageCode === lang) ||
    arr.find((t) => t.languageCode === 'en') ||
    arr[0];

  const mappedFiles = files.map((file) => {
    const fileTranslation = pick(file.translations);

    const contentTypeTranslation = file.contentType?.translations?.length
      ? pick(file.contentType.translations)
      : null;

    const categoryTranslation =
      file.contentType?.category?.translations?.length
        ? pick(file.contentType.category.translations)
        : null;

    const subcategoryTranslation =
      file.contentType?.subcategory?.translations?.length
        ? pick(file.contentType.subcategory.translations)
        : null;

    return {
      id: file.id,
      name: fileTranslation?.displayName || file.originalName,
      originalName: file.originalName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      url: file.url,
      year: file.contentYear,
      createdAt: file.createdAt,
      contentType: contentTypeTranslation?.name || null,
      category: categoryTranslation?.name || null,
      subcategory: subcategoryTranslation?.name || null,
    };
  });

  const sortFn = (a: string, b: string) =>
    a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: 'base',
    });

  if (sortBy === 'originalName') {
    mappedFiles.sort((a, b) =>
      order === 'asc'
        ? sortFn(a.originalName || '', b.originalName || '')
        : sortFn(b.originalName || '', a.originalName || '')
    );
  }

  if (sortBy === 'name') {
    mappedFiles.sort((a, b) =>
      order === 'asc'
        ? sortFn(a.name || '', b.name || '')
        : sortFn(b.name || '', a.name || '')
    );
  }

  return isStringSort
    ? mappedFiles.slice(skip, skip + take)
    : mappedFiles;
}
}
