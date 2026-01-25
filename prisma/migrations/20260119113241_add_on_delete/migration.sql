/*
  Warnings:

  - You are about to drop the column `isDeleted` on the `category` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `category_translation` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `subcategory` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `subcategory_translation` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "category_translation" DROP CONSTRAINT "category_translation_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "subcategory" DROP CONSTRAINT "subcategory_category_id_fkey";

-- AlterTable
ALTER TABLE "category" DROP COLUMN "isDeleted";

-- AlterTable
ALTER TABLE "category_translation" DROP COLUMN "isDeleted";

-- AlterTable
ALTER TABLE "subcategory" DROP COLUMN "isDeleted";

-- AlterTable
ALTER TABLE "subcategory_translation" DROP COLUMN "isDeleted";

-- AddForeignKey
ALTER TABLE "category_translation" ADD CONSTRAINT "category_translation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategory" ADD CONSTRAINT "subcategory_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
