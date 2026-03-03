-- DropIndex
DROP INDEX "subcategory_search_idx";

-- AlterTable
ALTER TABLE "file_asset" ADD COLUMN     "search_vector" tsvector;
