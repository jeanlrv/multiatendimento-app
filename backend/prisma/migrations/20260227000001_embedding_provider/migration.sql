-- Migration: 20260227000001_embedding_provider
-- Adiciona campos embeddingProvider e embeddingModel em AIAgent e KnowledgeBase

-- AIAgent: embedding provider e modelo
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "embeddingProvider" TEXT NOT NULL DEFAULT 'openai';
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "embeddingModel" TEXT NOT NULL DEFAULT 'text-embedding-3-small';

-- KnowledgeBase: embedding provider e modelo
ALTER TABLE "knowledge_bases" ADD COLUMN IF NOT EXISTS "embeddingProvider" TEXT NOT NULL DEFAULT 'openai';
ALTER TABLE "knowledge_bases" ADD COLUMN IF NOT EXISTS "embeddingModel" TEXT NOT NULL DEFAULT 'text-embedding-3-small';
