/*
  Warnings:

  - You are about to drop the column `data_year` on the `file_asset` table. All the data in the column will be lost.
  - Added the required column `content_year` to the `content_type` table without a default value. This is not possible if the table is not empty.
  - Added the required column `file_type` to the `file_asset` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('IMAGE', 'PDF', 'WORD', 'TEXT', 'CSV', 'EXCEL', 'OTHER');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- DropForeignKey
ALTER TABLE "content_type" DROP CONSTRAINT "content_type_category_id_fkey";

-- DropForeignKey
ALTER TABLE "content_type" DROP CONSTRAINT "content_type_subcategory_id_fkey";

-- AlterTable
ALTER TABLE "content_type" ADD COLUMN     "content_year" INTEGER NOT NULL,
ADD COLUMN     "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "file_asset" DROP COLUMN "data_year",
ADD COLUMN     "file_type" "FileType" NOT NULL;

-- CreateTable
CREATE TABLE "content_metadata" (
    "id" SERIAL NOT NULL,
    "content_type_id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "content_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_metadata_key_idx" ON "content_metadata"("key");

-- CreateIndex
CREATE INDEX "content_metadata_content_type_id_idx" ON "content_metadata"("content_type_id");

-- CreateIndex
CREATE INDEX "content_type_category_id_idx" ON "content_type"("category_id");

-- CreateIndex
CREATE INDEX "content_type_subcategory_id_idx" ON "content_type"("subcategory_id");

-- CreateIndex
CREATE INDEX "content_type_content_year_idx" ON "content_type"("content_year");

-- CreateIndex
CREATE INDEX "file_asset_file_type_idx" ON "file_asset"("file_type");

-- CreateIndex
CREATE INDEX "file_asset_content_type_id_idx" ON "file_asset"("content_type_id");

-- AddForeignKey
ALTER TABLE "content_type" ADD CONSTRAINT "content_type_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_type" ADD CONSTRAINT "content_type_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_metadata" ADD CONSTRAINT "content_metadata_content_type_id_fkey" FOREIGN KEY ("content_type_id") REFERENCES "content_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;
