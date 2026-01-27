/*
  Warnings:

  - You are about to drop the `CategoryTranslation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CategoryTranslation" DROP CONSTRAINT "CategoryTranslation_category_id_fkey";

-- DropTable
DROP TABLE "CategoryTranslation";

-- CreateTable
CREATE TABLE "category_translation" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "category_translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_translation_language_slug_key" ON "category_translation"("language", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "category_translation_category_id_language_key" ON "category_translation"("category_id", "language");

-- AddForeignKey
ALTER TABLE "category_translation" ADD CONSTRAINT "category_translation_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
