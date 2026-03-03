-- DropIndex
DROP INDEX "category_search_idx";

-- AlterTable
ALTER TABLE "subcategory" ADD COLUMN     "search_vector" tsvector;
