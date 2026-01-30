-- DropForeignKey
ALTER TABLE "subcategory_translation" DROP CONSTRAINT "subcategory_translation_subcategoryId_fkey";

-- AddForeignKey
ALTER TABLE "subcategory_translation" ADD CONSTRAINT "subcategory_translation_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "subcategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
