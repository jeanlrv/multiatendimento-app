-- AlterTable: adiciona colunas de webhook na knowledge_bases
ALTER TABLE "knowledge_bases"
  ADD COLUMN "webhookEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "webhookApiKey"  TEXT;

-- Garante unicidade da API key
CREATE UNIQUE INDEX "knowledge_bases_webhookApiKey_key" ON "knowledge_bases"("webhookApiKey");

-- CreateTable: log de sincronização do agente local
CREATE TABLE "kb_sync_logs" (
    "id"              TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "filename"        TEXT NOT NULL,
    "fileSize"        INTEGER,
    "status"          TEXT NOT NULL,
    "errorMessage"    TEXT,
    "documentId"      TEXT,
    "agentHostname"   TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_sync_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "kb_sync_logs"
  ADD CONSTRAINT "kb_sync_logs_knowledgeBaseId_fkey"
  FOREIGN KEY ("knowledgeBaseId")
  REFERENCES "knowledge_bases"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "kb_sync_logs_knowledgeBaseId_idx" ON "kb_sync_logs"("knowledgeBaseId");
CREATE INDEX "kb_sync_logs_createdAt_idx" ON "kb_sync_logs"("createdAt");
