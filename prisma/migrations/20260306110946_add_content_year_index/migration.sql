-- DropIndex
DROP INDEX "file_asset_content_type_id_idx";

-- CreateIndex
CREATE INDEX "file_asset_content_year_idx" ON "file_asset"("content_year");
