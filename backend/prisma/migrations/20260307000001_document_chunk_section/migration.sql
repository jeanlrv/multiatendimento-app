-- Add missing column `section` to document_chunks
-- This field exists in the Prisma schema but was never migrated to the database.
ALTER TABLE "document_chunks" ADD COLUMN IF NOT EXISTS "section" TEXT;
