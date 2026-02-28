-- Migration: 20260228000003_catchup_sync
-- Sincroniza o banco de dados com o schema.prisma atual, adicionando campos e tabelas ausentes.
-- 1. Criar Enums se não existirem
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'PlanTier'
) THEN CREATE TYPE "PlanTier" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');
END IF;
END $$;
-- 2. Atualizar Tabela "companies" (Colunas Básicas)
ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "plan" "PlanTier" NOT NULL DEFAULT 'STARTER';
ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "maxUsers" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "maxDepartments" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "maxWhatsApp" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "primaryColor" TEXT NOT NULL DEFAULT '#3B82F6';
ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT NOT NULL DEFAULT '#1E293B';
ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "limitTokensPerHour" INTEGER NOT NULL DEFAULT 10000;
ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "limitTokensPerDay" INTEGER NOT NULL DEFAULT 100000;
-- 3. Atualizar Tabela "ai_agents" (Colunas Básicas)
-- Nota: companyId já deve existir da migração init, mas garantimos aqui se necessário
ALTER TABLE "ai_agents"
ADD COLUMN IF NOT EXISTS "prompt" TEXT;
ALTER TABLE "ai_agents"
ADD COLUMN IF NOT EXISTS "modelId" TEXT NOT NULL DEFAULT 'gpt-4o-mini';
ALTER TABLE "ai_agents"
ADD COLUMN IF NOT EXISTS "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7;
ALTER TABLE "ai_agents"
ADD COLUMN IF NOT EXISTS "knowledgeBaseId" TEXT;
ALTER TABLE "ai_agents"
ADD COLUMN IF NOT EXISTS "embedId" TEXT;
ALTER TABLE "ai_agents"
ADD COLUMN IF NOT EXISTS "embedEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ai_agents"
ADD COLUMN IF NOT EXISTS "embedBrandColor" TEXT NOT NULL DEFAULT '#4F46E5';
ALTER TABLE "ai_agents"
ADD COLUMN IF NOT EXISTS "embedBrandLogo" TEXT;
ALTER TABLE "ai_agents"
ADD COLUMN IF NOT EXISTS "embedAgentName" TEXT;
ALTER TABLE "ai_agents"
ADD COLUMN IF NOT EXISTS "embedWelcomeMsg" TEXT;
ALTER TABLE "ai_agents"
ADD COLUMN IF NOT EXISTS "embedPlaceholder" TEXT NOT NULL DEFAULT 'Digite sua mensagem...';
ALTER TABLE "ai_agents"
ADD COLUMN IF NOT EXISTS "embedPosition" TEXT NOT NULL DEFAULT 'bottom-right';
ALTER TABLE "ai_agents"
ADD COLUMN IF NOT EXISTS "embedAllowedDomains" TEXT [] DEFAULT ARRAY []::TEXT [];
ALTER TABLE "ai_agents"
ADD COLUMN IF NOT EXISTS "embedRateLimit" INTEGER NOT NULL DEFAULT 20;
-- 4. Criar Tabelas Novas (Que dependem das colunas acima)
CREATE TABLE IF NOT EXISTS "knowledge_bases" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "companyId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'portuguese',
    "embeddingProvider" TEXT NOT NULL DEFAULT 'openai',
    "embeddingModel" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "documents" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "contentUrl" TEXT,
    "rawContent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "document_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "metadata" JSONB,
    "embedding" JSONB,
    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "agentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "embed_chat_sessions" (
    "id" TEXT NOT NULL,
    "embedId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "embed_chat_sessions_pkey" PRIMARY KEY ("id")
);
-- 5. Outras Atualizações de Tabelas Existentes
ALTER TABLE "departments"
ADD COLUMN IF NOT EXISTS "outOfHoursMessage" TEXT;
ALTER TABLE "departments"
ADD COLUMN IF NOT EXISTS "greetingMessage" TEXT;
ALTER TABLE "messages"
ADD COLUMN IF NOT EXISTS "quotedMessageId" TEXT;
-- 6. UNIQUE INDEXES (Somente após as colunas existirem)
CREATE UNIQUE INDEX IF NOT EXISTS "ai_agents_embedId_key" ON "ai_agents"("embedId");
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_keyHash_key" ON "api_keys"("keyHash");
CREATE UNIQUE INDEX IF NOT EXISTS "embed_chat_sessions_embedId_sessionId_key" ON "embed_chat_sessions"("embedId", "sessionId");
-- 7. NORMAL INDEXES
CREATE INDEX IF NOT EXISTS "knowledge_bases_companyId_idx" ON "knowledge_bases"("companyId");
CREATE INDEX IF NOT EXISTS "documents_knowledgeBaseId_idx" ON "documents"("knowledgeBaseId");
CREATE INDEX IF NOT EXISTS "documents_status_idx" ON "documents"("status");
CREATE INDEX IF NOT EXISTS "document_chunks_documentId_idx" ON "document_chunks"("documentId");
CREATE INDEX IF NOT EXISTS "ai_agents_knowledgeBaseId_idx" ON "ai_agents"("knowledgeBaseId");
CREATE INDEX IF NOT EXISTS "api_keys_companyId_idx" ON "api_keys"("companyId");
CREATE INDEX IF NOT EXISTS "embed_chat_sessions_embedId_sessionId_idx" ON "embed_chat_sessions"("embedId", "sessionId");
-- 8. Foreign Keys (Usando blocos DO para segurança)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'knowledge_bases_companyId_fkey'
) THEN
ALTER TABLE "knowledge_bases"
ADD CONSTRAINT "knowledge_bases_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'documents_knowledgeBaseId_fkey'
) THEN
ALTER TABLE "documents"
ADD CONSTRAINT "documents_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'document_chunks_documentId_fkey'
) THEN
ALTER TABLE "document_chunks"
ADD CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ai_agents_knowledgeBaseId_fkey'
) THEN
ALTER TABLE "ai_agents"
ADD CONSTRAINT "ai_agents_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE
SET NULL ON UPDATE CASCADE;
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'api_keys_companyId_fkey'
) THEN
ALTER TABLE "api_keys"
ADD CONSTRAINT "api_keys_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'api_keys_agentId_fkey'
) THEN
ALTER TABLE "api_keys"
ADD CONSTRAINT "api_keys_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE
SET NULL ON UPDATE CASCADE;
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'messages_quotedMessageId_fkey'
) THEN
ALTER TABLE "messages"
ADD CONSTRAINT "messages_quotedMessageId_fkey" FOREIGN KEY ("quotedMessageId") REFERENCES "messages"("id") ON DELETE
SET NULL ON UPDATE CASCADE;
END IF;
END $$;