-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";
-- AlterTable
ALTER TABLE "document_chunks" DROP COLUMN "embedding";
ALTER TABLE "document_chunks"
ADD COLUMN "embedding" vector;