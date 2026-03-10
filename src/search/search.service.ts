import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async globalSearch(
    query: string,
    languageCode: string,
    skip = 0,
    take = 20,
    year?: number,
  ) {
    if (!query || !query.trim()) {
      return [];
    }

    return this.prisma.$queryRaw(
      Prisma.sql`
SELECT * FROM (

  -- Category
  SELECT 
    'category' AS type,
    c.id,
    c.slug,
    (
      SELECT name
      FROM category_translation
      WHERE category_id = c.id
      AND language_code = ${languageCode}
      LIMIT 1
    ) AS title,
    ts_rank(COALESCE(c.search_vector,''), plainto_tsquery('simple',${query})) AS rank
  FROM category c
  WHERE
      c.search_vector @@ plainto_tsquery('simple',${query})
      OR EXISTS (
        SELECT 1
        FROM category_translation ct
        WHERE ct.category_id = c.id
        AND ct.language_code = ${languageCode}
        AND ct.name ILIKE '%' || ${query} || '%'
      )

  UNION ALL

  -- Subcategory
  SELECT 
    'subcategory',
    s.id,
    s.slug,
    (
      SELECT name
      FROM subcategory_translation
      WHERE subcategory_id = s.id
      AND language_code = ${languageCode}
      LIMIT 1
    ),
    ts_rank(COALESCE(s.search_vector,''), plainto_tsquery('simple',${query}))
  FROM subcategory s
  WHERE
      s.search_vector @@ plainto_tsquery('simple',${query})
      OR EXISTS (
        SELECT 1
        FROM subcategory_translation st
        WHERE st.subcategory_id = s.id
        AND st.language_code = ${languageCode}
        AND st.name ILIKE '%' || ${query} || '%'
      )

  UNION ALL

  -- ContentType
  SELECT
    'content',
    ct.id,
    ct.slug,
    (
      SELECT name
      FROM content_type_translation
      WHERE content_type_id = ct.id
      AND language_code = ${languageCode}
      LIMIT 1
    ),
    ts_rank(COALESCE(ct.search_vector,''), plainto_tsquery('simple',${query}))
  FROM content_type ct
  WHERE
      (${year ?? null}::int IS NULL OR ct.content_year = ${year ?? null})
  AND (
      ct.search_vector @@ plainto_tsquery('simple',${query})
      OR EXISTS (
        SELECT 1
        FROM content_type_translation ctt
        WHERE ctt.content_type_id = ct.id
        AND ctt.language_code = ${languageCode}
        AND ctt.name ILIKE '%' || ${query} || '%'
      )
  )

  UNION ALL

  -- FileAsset
  SELECT
    'file',
    f.id,
    NULL,
    (
      SELECT "displayName"
      FROM file_translation
      WHERE file_id = f.id
      AND language_code = ${languageCode}
      LIMIT 1
    ),
    ts_rank(COALESCE(f.search_vector,''), plainto_tsquery('simple',${query}))
  FROM file_asset f
  WHERE
      (${year ?? null}::int IS NULL OR f.content_year = ${year ?? null})
  AND (
      f.search_vector @@ plainto_tsquery('simple',${query})
      OR EXISTS (
        SELECT 1
        FROM file_translation ft
        WHERE ft.file_id = f.id
        AND ft.language_code = ${languageCode}
        AND ft."displayName" ILIKE '%' || ${query} || '%'
      )
  )

) results
ORDER BY rank DESC
LIMIT ${take} OFFSET ${skip}
`,
    );
  }
}
