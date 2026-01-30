-- CreateTable
CREATE TABLE "category_translation" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "languageCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "category_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcategory_translation" (
    "id" SERIAL NOT NULL,
    "subcategoryId" INTEGER NOT NULL,
    "languageCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "subcategory_translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_translation_categoryId_languageCode_key" ON "category_translation"("categoryId", "languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "subcategory_translation_subcategoryId_languageCode_key" ON "subcategory_translation"("subcategoryId", "languageCode");

-- AddForeignKey
ALTER TABLE "category_translation" ADD CONSTRAINT "category_translation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategory_translation" ADD CONSTRAINT "subcategory_translation_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "subcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
