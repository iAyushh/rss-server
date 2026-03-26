-- AlterTable
ALTER TABLE "file_asset" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "file_asset_updated_at_idx" ON "file_asset"("updated_at");

-- CreateIndex
CREATE INDEX "file_asset_file_size_idx" ON "file_asset"("file_size");

-- CreateIndex
CREATE INDEX "file_asset_content_type_id_idx" ON "file_asset"("content_type_id");

-- CreateIndex
CREATE INDEX "file_asset_content_type_id_updated_at_idx" ON "file_asset"("content_type_id", "updated_at");

-- CreateIndex
CREATE INDEX "file_metadata_file_id_idx" ON "file_metadata"("file_id");
