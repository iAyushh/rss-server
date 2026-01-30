/*
  Warnings:

  - You are about to drop the `category_translation` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `slug` to the `category` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "category_translation" DROP CONSTRAINT "category_translation_category_id_fkey";

-- AlterTable
ALTER TABLE "category" ADD COLUMN     "slug" TEXT NOT NULL;

-- DropTable
DROP TABLE "category_translation";
