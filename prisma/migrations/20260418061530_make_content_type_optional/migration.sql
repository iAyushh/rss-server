-- drop old FK safely
ALTER TABLE "file_asset"
DROP CONSTRAINT IF EXISTS "file_asset_content_type_id_fkey";

-- make column optional
ALTER TABLE "file_asset"
ALTER COLUMN "content_type_id" DROP NOT NULL;

-- re-add FK with SET NULL
ALTER TABLE "file_asset"
ADD CONSTRAINT "file_asset_content_type_id_fkey"
FOREIGN KEY ("content_type_id")
REFERENCES "content_type"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;