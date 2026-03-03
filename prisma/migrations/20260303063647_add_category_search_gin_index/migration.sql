-- This is an empty migration.
CREATE INDEX category_search_idx
ON category
USING GIN (search_vector);