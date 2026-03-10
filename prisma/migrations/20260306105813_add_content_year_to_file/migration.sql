-- DropIndex
DROP INDEX "fileasset_search_idx";

-- AlterTable
ALTER TABLE "file_asset" ADD COLUMN     "content_year" INTEGER;
