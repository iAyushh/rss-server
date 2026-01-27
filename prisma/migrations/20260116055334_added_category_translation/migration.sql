/*
  Warnings:

  - You are about to drop the column `slug` on the `category` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `subcategory` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[category_id]` on the table `subcategory` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "category_slug_key";

-- DropIndex
DROP INDEX "subcategory_category_id_slug_key";

-- AlterTable
ALTER TABLE "category" DROP COLUMN "slug";

-- AlterTable
ALTER TABLE "subcategory" DROP COLUMN "slug";

-- CreateTable
CREATE TABLE "CategoryTranslation" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "CategoryTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subcategory_category_id_key" ON "subcategory"("category_id");

-- AddForeignKey
ALTER TABLE "CategoryTranslation" ADD CONSTRAINT "CategoryTranslation_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
