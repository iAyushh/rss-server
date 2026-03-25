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

-- CATEGORY
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

-- SUBCATEGORY
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

-- CONTENT
SELECT
  'content' AS type,
  ct.id,
  ct.slug,
  ct.content_year AS year,
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
  OR ct.content_year::text LIKE ${yearLike}
)
AND (
  (${searchTerm})::text IS NULL
  OR ct.search_vector @@ to_tsquery('simple', (${searchTerm})::text || ':*')
)

UNION ALL

-- FILE
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
}