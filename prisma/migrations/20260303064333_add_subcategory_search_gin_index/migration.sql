-- This is an empty migration.

CREATE INDEX subcategory_search_idx
ON subcategory
USING GIN (search_vector);