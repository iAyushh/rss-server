/*
  Warnings:

  - A unique constraint covering the columns `[category_id,slug]` on the table `subcategory` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `subcategory` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "subcategory_category_id_key";

-- AlterTable
ALTER TABLE "category" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL  DEFAULT NOW();

-- AlterTable
ALTER TABLE "subcategory" ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "subcategory_category_id_slug_key" ON "subcategory"("category_id", "slug");
