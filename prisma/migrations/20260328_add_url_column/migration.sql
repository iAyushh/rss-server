-- sync url column
ALTER TABLE "file_asset"
ADD COLUMN IF NOT EXISTS "url" TEXT;