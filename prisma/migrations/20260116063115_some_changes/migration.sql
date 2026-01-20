-- DropForeignKey
ALTER TABLE "category_translation" DROP CONSTRAINT "category_translation_category_id_fkey";

-- AddForeignKey
ALTER TABLE "category_translation" ADD CONSTRAINT "category_translation_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
