-- AlterTable
ALTER TABLE "content_type" ADD COLUMN     "subcategory_id" INTEGER;

-- AddForeignKey
ALTER TABLE "content_type" ADD CONSTRAINT "content_type_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "subcategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
