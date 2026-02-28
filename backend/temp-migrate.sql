CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";
ALTER TABLE "document_chunks" DROP COLUMN "embedding";
ALTER TABLE "document_chunks"
ADD COLUMN "embedding" vector;