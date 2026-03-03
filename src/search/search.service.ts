import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async globalSearch(query: string, skip = 0, take = 20) {
    if (!query || !query.trim()) {
      return [];
    }

    return this.prisma.$queryRawUnsafe(
      `
    SELECT * FROM (

      -- Category
      SELECT 
        'category' as type,
        c.id,
        c.slug,
        ct.name as title,
        ts_rank(c.search_vector, plainto_tsquery('simple', $1)) as rank
      FROM category c
      JOIN category_translation ct 
        ON ct.category_id = c.id
      WHERE 
  c.search_vector @@ plainto_tsquery('simple', $1)
  OR ct.name ILIKE '%' || $1 || '%'
  OR c.slug ILIKE '%' || $1 || '%'

      UNION ALL

      -- Subcategory
      SELECT 
        'subcategory' as type,
        s.id,
        s.slug,
        st.name as title,
        ts_rank(s.search_vector, plainto_tsquery('simple', $1)) as rank
      FROM subcategory s
      JOIN subcategory_translation st 
        ON st.subcategory_id = s.id
    WHERE 
  s.search_vector @@ plainto_tsquery('simple', $1)
  OR st.name ILIKE '%' || $1 || '%'
  OR s.slug ILIKE '%' || $1 || '%'

      UNION ALL

      -- ContentType
      SELECT 
        'content' as type,
        ct2.id,
        ct2.slug,
        ctt.name as title,
        ts_rank(ct2.search_vector, plainto_tsquery('simple', $1)) as rank
      FROM content_type ct2
      JOIN content_type_translation ctt 
        ON ctt.content_type_id = ct2.id
     WHERE 
  ct2.search_vector @@ plainto_tsquery('simple', $1)
  OR ctt.name ILIKE '%' || $1 || '%'
  OR ct2.slug ILIKE '%' || $1 || '%'

      UNION ALL

      -- FileAsset
      SELECT 
        'file' as type,
        f.id,
        NULL as slug,
        ft."displayName" as title,
        ts_rank(f.search_vector, plainto_tsquery('simple', $1)) as rank
      FROM file_asset f
      JOIN file_translation ft 
        ON ft.file_id = f.id
      WHERE 
  f.search_vector @@ plainto_tsquery('simple', $1)
  OR ft."displayName" ILIKE '%' || $1 || '%'

    ) results
    ORDER BY rank DESC
    LIMIT $2 OFFSET $3
    `,
      query,
      take,
      skip,
    );
  }
}
