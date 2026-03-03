-- This is an empty migration.
CREATE INDEX fileasset_search_idx
ON file_asset
USING GIN (search_vector);