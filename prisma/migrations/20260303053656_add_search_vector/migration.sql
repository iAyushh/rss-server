/*
  Warnings:

  - You are about to drop the column `file_name` on the `file_asset` table. All the data in the column will be lost.
  - You are about to drop the column `file_type` on the `file_asset` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slug,content_year]` on the table `content_type` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[storage_key]` on the table `file_asset` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `content_type` table without a default value. This is not possible if the table is not empty.
  - Added the required column `extension` to the `file_asset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileType` to the `file_asset` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "file_type" AS ENUM ('IMAGE', 'PDF', 'WORD', 'TEXT', 'CSV', 'EXCEL', 'AUDIO', 'VIDEO', 'OTHER');

-- DropIndex
DROP INDEX "content_type_category_id_idx";

-- DropIndex
DROP INDEX "content_type_subcategory_id_idx";

-- DropIndex
DROP INDEX "file_asset_file_type_idx";

-- AlterTable
ALTER TABLE "content_type" ADD COLUMN     "search_vector" tsvector,
ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "file_asset" DROP COLUMN "file_name",
DROP COLUMN "file_type",
ADD COLUMN     "extension" TEXT NOT NULL,
ADD COLUMN     "fileType" "file_type" NOT NULL,
ADD COLUMN     "original_name" TEXT;

-- DropEnum
DROP TYPE "FileType";

-- CreateTable
CREATE TABLE "file_translation" (
    "id" SERIAL NOT NULL,
    "file_id" INTEGER NOT NULL,
    "language_code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "file_translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "file_translation_language_code_idx" ON "file_translation"("language_code");

-- CreateIndex
CREATE UNIQUE INDEX "file_translation_file_id_language_code_key" ON "file_translation"("file_id", "language_code");

-- CreateIndex
CREATE INDEX "content_metadata_value_idx" ON "content_metadata"("value");

-- CreateIndex
CREATE INDEX "content_metadata_key_value_idx" ON "content_metadata"("key", "value");

-- CreateIndex
CREATE INDEX "content_type_category_id_content_year_idx" ON "content_type"("category_id", "content_year");

-- CreateIndex
CREATE INDEX "content_type_subcategory_id_content_year_idx" ON "content_type"("subcategory_id", "content_year");

-- CreateIndex
CREATE UNIQUE INDEX "content_type_slug_content_year_key" ON "content_type"("slug", "content_year");

-- CreateIndex
CREATE UNIQUE INDEX "file_asset_storage_key_key" ON "file_asset"("storage_key");

-- CreateIndex
CREATE INDEX "file_asset_fileType_idx" ON "file_asset"("fileType");

-- AddForeignKey
ALTER TABLE "file_translation" ADD CONSTRAINT "file_translation_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
