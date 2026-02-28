-- AddColumn: language to knowledge_bases (default 'portuguese' for FTS)
ALTER TABLE "knowledge_bases" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'portuguese';
