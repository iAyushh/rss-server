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
      AND language_code = $2
      LIMIT 1
    ) AS title,
    ts_rank(COALESCE(c.search_vector,''), plainto_tsquery('simple',$1)) AS rank
  FROM category c
  WHERE
      c.search_vector @@ plainto_tsquery('simple',$1)
      OR EXISTS (
        SELECT 1
        FROM category_translation ct
        WHERE ct.category_id = c.id
        AND ct.language_code = $2
        AND ct.name ILIKE '%' || $1 || '%'
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
      AND language_code = $2
      LIMIT 1
    ),
    ts_rank(COALESCE(s.search_vector,''), plainto_tsquery('simple',$1))
  FROM subcategory s
  WHERE
      s.search_vector @@ plainto_tsquery('simple',$1)
      OR EXISTS (
        SELECT 1
        FROM subcategory_translation st
        WHERE st.subcategory_id = s.id
        AND st.language_code = $2
        AND st.name ILIKE '%' || $1 || '%'
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
      AND language_code = $2
      LIMIT 1
    ),
    ts_rank(COALESCE(ct.search_vector,''), plainto_tsquery('simple',$1))
 FROM content_type ct
WHERE
      ($5::int IS NULL OR ct.content_year = $5)
  AND (
      ct.search_vector @@ plainto_tsquery('simple',$1)
      OR EXISTS (
        SELECT 1
        FROM content_type_translation ctt
        WHERE ctt.content_type_id = ct.id
        AND ctt.language_code = $2
        AND ctt.name ILIKE '%' || $1 || '%'
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
      AND language_code = $2
      LIMIT 1
    ),
    ts_rank(COALESCE(f.search_vector,''), plainto_tsquery('simple',$1))
 FROM file_asset f
WHERE
      ($5::int IS NULL OR f.content_year = $5)
  AND (
      f.search_vector @@ plainto_tsquery('simple',$1)
      OR EXISTS (
        SELECT 1
        FROM file_translation ft
        WHERE ft.file_id = f.id
        AND ft.language_code = $2
        AND ft."displayName" ILIKE '%' || $1 || '%'
      )
  )

) results
ORDER BY rank DESC
LIMIT $3 OFFSET $4
`,
      query,
      languageCode,
      take,
      skip,
      year ?? null,
    );
  }
}
