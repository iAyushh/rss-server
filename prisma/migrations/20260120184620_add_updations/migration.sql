/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `category` table. All the data in the column will be lost.
  - You are about to drop the column `categoryId` on the `category_translation` table. All the data in the column will be lost.
  - You are about to drop the column `languageCode` on the `category_translation` table. All the data in the column will be lost.
  - You are about to drop the column `languageCode` on the `subcategory_translation` table. All the data in the column will be lost.
  - You are about to drop the column `subcategoryId` on the `subcategory_translation` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[category_id,language_code]` on the table `category_translation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[subcategory_id,language_code]` on the table `subcategory_translation` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category_id` to the `category_translation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `language_code` to the `category_translation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `language_code` to the `subcategory_translation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subcategory_id` to the `subcategory_translation` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "category_translation" DROP CONSTRAINT "category_translation_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "subcategory_translation" DROP CONSTRAINT "subcategory_translation_subcategoryId_fkey";

-- DropIndex
DROP INDEX "category_translation_categoryId_languageCode_key";

-- DropIndex
DROP INDEX "subcategory_translation_subcategoryId_languageCode_key";

-- AlterTable
ALTER TABLE "category" DROP COLUMN "updatedAt",
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "category_translation" DROP COLUMN "categoryId",
DROP COLUMN "languageCode",
ADD COLUMN     "category_id" INTEGER NOT NULL,
ADD COLUMN     "language_code" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "subcategory_translation" DROP COLUMN "languageCode",
DROP COLUMN "subcategoryId",
ADD COLUMN     "language_code" TEXT NOT NULL,
ADD COLUMN     "subcategory_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "content_type" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_asset" (
    "id" SERIAL NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "data_year" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content_type_id" INTEGER NOT NULL,

    CONSTRAINT "file_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_type_translation" (
    "id" SERIAL NOT NULL,
    "content_type_id" INTEGER NOT NULL,
    "language_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "content_type_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_metadata" (
    "id" SERIAL NOT NULL,
    "file_id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "file_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_type_translation_content_type_id_language_code_key" ON "content_type_translation"("content_type_id", "language_code");

-- CreateIndex
CREATE INDEX "file_metadata_key_idx" ON "file_metadata"("key");

-- CreateIndex
CREATE UNIQUE INDEX "category_translation_category_id_language_code_key" ON "category_translation"("category_id", "language_code");

-- CreateIndex
CREATE UNIQUE INDEX "subcategory_translation_subcategory_id_language_code_key" ON "subcategory_translation"("subcategory_id", "language_code");

-- AddForeignKey
ALTER TABLE "category_translation" ADD CONSTRAINT "category_translation_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategory_translation" ADD CONSTRAINT "subcategory_translation_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "subcategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_type" ADD CONSTRAINT "content_type_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_asset" ADD CONSTRAINT "file_asset_content_type_id_fkey" FOREIGN KEY ("content_type_id") REFERENCES "content_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_type_translation" ADD CONSTRAINT "content_type_translation_content_type_id_fkey" FOREIGN KEY ("content_type_id") REFERENCES "content_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_metadata" ADD CONSTRAINT "file_metadata_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
