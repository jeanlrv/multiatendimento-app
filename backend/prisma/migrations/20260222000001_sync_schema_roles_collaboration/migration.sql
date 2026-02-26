-- ============================================================================
-- Migration: sync_schema_roles_collaboration
-- Sincroniza o schema Prisma com o banco de dados.
-- Criações seguras com IF NOT EXISTS para ambientes que usaram db push.
-- ============================================================================
-- ─── 1. Remover enum legado UserRole (se existir) e coluna legada role ──────
-- Remover coluna legada "role" da tabela users (era UserRole enum, substituída por roleId FK)
DO $$ BEGIN IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
        AND column_name = 'role'
) THEN
ALTER TABLE "users" DROP COLUMN "role";
END IF;
END $$;
-- Remover enum legado UserRole (se existir)
DO $$ BEGIN IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'UserRole'
) THEN DROP TYPE "UserRole";
END IF;
END $$;
-- ─── 2. Criar tabela roles ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT [] NOT NULL DEFAULT '{}',
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "roles_companyId_name_key" ON "roles"("companyId", "name");
CREATE INDEX IF NOT EXISTS "roles_companyId_idx" ON "roles"("companyId");
-- ─── 3. Adicionar coluna roleId em users ────────────────────────────────────
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
        AND column_name = 'roleId'
) THEN
ALTER TABLE "users"
ADD COLUMN "roleId" TEXT;
END IF;
END $$;
-- FK de users.roleId → roles.id (adicionar apenas se não existir)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'users_roleId_fkey'
        AND table_name = 'users'
) THEN
ALTER TABLE "users"
ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;
-- FK de roles.companyId → companies.id (adicionar apenas se não existir)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'roles_companyId_fkey'
        AND table_name = 'roles'
) THEN
ALTER TABLE "roles"
ADD CONSTRAINT "roles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;
-- ─── 4. Adicionar colunas de branding na tabela companies ───────────────────
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'companies'
        AND column_name = 'logoUrl'
) THEN
ALTER TABLE "companies"
ADD COLUMN "logoUrl" TEXT;
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'companies'
        AND column_name = 'primaryColor'
) THEN
ALTER TABLE "companies"
ADD COLUMN "primaryColor" TEXT NOT NULL DEFAULT '#3B82F6';
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'companies'
        AND column_name = 'secondaryColor'
) THEN
ALTER TABLE "companies"
ADD COLUMN "secondaryColor" TEXT NOT NULL DEFAULT '#1E293B';
END IF;
END $$;
-- ─── 5. Remover DEFAULT 'default-company' de ai_agents e evaluations ────────
DO $$ BEGIN
ALTER TABLE "ai_agents"
ALTER COLUMN "companyId" DROP DEFAULT;
EXCEPTION
WHEN others THEN NULL;
END $$;
DO $$ BEGIN
ALTER TABLE "evaluations"
ALTER COLUMN "companyId" DROP DEFAULT;
EXCEPTION
WHEN others THEN NULL;
END $$;
-- ─── 6. Criar enum InternalChatType (se não existir) ───────────────────────
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'InternalChatType'
) THEN CREATE TYPE "InternalChatType" AS ENUM ('DIRECT', 'GROUP');
END IF;
END $$;
-- ─── 7. Criar tabela internal_chats ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "internal_chats" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "type" "InternalChatType" NOT NULL DEFAULT 'DIRECT',
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "internal_chats_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'internal_chats_companyId_fkey'
        AND table_name = 'internal_chats'
) THEN
ALTER TABLE "internal_chats"
ADD CONSTRAINT "internal_chats_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;
-- ─── 8. Criar tabela internal_chat_members ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "internal_chat_members" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "internal_chat_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "internal_chat_members_chatId_userId_key" ON "internal_chat_members"("chatId", "userId");
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'internal_chat_members_chatId_fkey'
) THEN
ALTER TABLE "internal_chat_members"
ADD CONSTRAINT "internal_chat_members_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "internal_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'internal_chat_members_userId_fkey'
) THEN
ALTER TABLE "internal_chat_members"
ADD CONSTRAINT "internal_chat_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;
-- ─── 9. Criar tabela internal_chat_messages ──────────────────────────────────
CREATE TABLE IF NOT EXISTS "internal_chat_messages" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT,
    "mediaUrl" TEXT,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "readAt" JSONB,
    "deliveredAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "internal_chat_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "internal_chat_messages_chatId_idx" ON "internal_chat_messages"("chatId");
CREATE INDEX IF NOT EXISTS "internal_chat_messages_senderId_idx" ON "internal_chat_messages"("senderId");
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'internal_chat_messages_chatId_fkey'
) THEN
ALTER TABLE "internal_chat_messages"
ADD CONSTRAINT "internal_chat_messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "internal_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'internal_chat_messages_senderId_fkey'
) THEN
ALTER TABLE "internal_chat_messages"
ADD CONSTRAINT "internal_chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;
-- ─── 10. Criar tabela saved_filters ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "saved_filters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "color" TEXT DEFAULT '#3B82F6',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saved_filters_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "saved_filters_userId_idx" ON "saved_filters"("userId");
CREATE INDEX IF NOT EXISTS "saved_filters_companyId_idx" ON "saved_filters"("companyId");
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'saved_filters_userId_fkey'
) THEN
ALTER TABLE "saved_filters"
ADD CONSTRAINT "saved_filters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'saved_filters_companyId_fkey'
) THEN
ALTER TABLE "saved_filters"
ADD CONSTRAINT "saved_filters_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;
-- ─── 11. Corrigir índice único da tabela tags (garantir companyId+name) ──────
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tags'
        AND column_name = 'companyId'
) THEN
ALTER TABLE "tags"
ADD COLUMN "companyId" TEXT;
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'tags'
        AND indexname = 'tags_companyId_name_key'
) THEN CREATE UNIQUE INDEX "tags_companyId_name_key" ON "tags"("companyId", "name");
END IF;
END $$;
-- ─── 12. Adicionar colunas extras em workflows que possam estar faltando ─────
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'workflow_rules'
        AND column_name = 'config'
) THEN
ALTER TABLE "workflow_rules"
ADD COLUMN "config" JSONB;
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'workflow_rules'
        AND column_name = 'runCount'
) THEN
ALTER TABLE "workflow_rules"
ADD COLUMN "runCount" INTEGER NOT NULL DEFAULT 0;
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'workflow_rules'
        AND column_name = 'environment'
) THEN
ALTER TABLE "workflow_rules"
ADD COLUMN "environment" TEXT NOT NULL DEFAULT 'PRODUCTION';
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'workflow_rules'
        AND column_name = 'isTemplate'
) THEN
ALTER TABLE "workflow_rules"
ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false;
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'workflow_rules'
        AND column_name = 'version'
) THEN
ALTER TABLE "workflow_rules"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
END IF;
END $$;
-- ─── 13. Adicionar colunas de zapiClientToken e webhookUrl em integrations ───
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'integrations'
        AND column_name = 'zapiClientToken'
) THEN
ALTER TABLE "integrations"
ADD COLUMN "zapiClientToken" TEXT;
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'integrations'
        AND column_name = 'webhookUrl'
) THEN
ALTER TABLE "integrations"
ADD COLUMN "webhookUrl" TEXT;
END IF;
END $$;
-- ─── 14. Adicionar colunas extras na tabela departments ──────────────────────
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'departments'
        AND column_name = 'emoji'
) THEN
ALTER TABLE "departments"
ADD COLUMN "emoji" TEXT DEFAULT '💬';
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'departments'
        AND column_name = 'color'
) THEN
ALTER TABLE "departments"
ADD COLUMN "color" TEXT NOT NULL DEFAULT '#2563eb';
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'departments'
        AND column_name = 'displayOrder'
) THEN
ALTER TABLE "departments"
ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'departments'
        AND column_name = 'workflowId'
) THEN
ALTER TABLE "departments"
ADD COLUMN "workflowId" TEXT;
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'departments'
        AND column_name = 'slaResolutionMin'
) THEN
ALTER TABLE "departments"
ADD COLUMN "slaResolutionMin" INTEGER;
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'departments'
        AND column_name = 'greetingMessage'
) THEN
ALTER TABLE "departments"
ADD COLUMN "greetingMessage" TEXT;
END IF;
END $$;