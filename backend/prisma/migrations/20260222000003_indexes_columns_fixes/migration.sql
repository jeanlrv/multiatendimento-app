-- Migration: 20260222000003_indexes_columns_fixes
-- Corrige índices faltantes e colunas ausentes identificados na análise técnica de 22/02/2026

-- ─────────────────────────────────────────────────────────────
-- 1. Coluna contact.information (ausente na migration inicial)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "information" TEXT;

-- ─────────────────────────────────────────────────────────────
-- 2. companyId em audit_logs (multi-tenancy)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "company_id" TEXT;

-- Preencher company_id retroativamente via userId → users.companyId
UPDATE "audit_logs" al
SET "company_id" = u."company_id"
FROM "users" u
WHERE al."user_id" = u."id"
  AND al."company_id" IS NULL;

CREATE INDEX IF NOT EXISTS "audit_logs_company_id_idx" ON "audit_logs"("company_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx"  ON "audit_logs"("created_at");

-- ─────────────────────────────────────────────────────────────
-- 3. Índices de performance faltantes
-- ─────────────────────────────────────────────────────────────

-- Messages: índice composto (ticketId + sentAt) para histórico paginado
CREATE INDEX IF NOT EXISTS "messages_ticket_id_sent_at_idx"
    ON "messages"("ticket_id", "sent_at");

-- Messages: índice isolado em sentAt para queries de período
CREATE INDEX IF NOT EXISTS "messages_sent_at_idx"
    ON "messages"("sent_at");

-- Contacts: índice em createdAt para relatórios de novos contatos
CREATE INDEX IF NOT EXISTS "contacts_created_at_idx"
    ON "contacts"("created_at");

-- Contacts: índice composto (companyId + createdAt) para filtros + período
CREATE INDEX IF NOT EXISTS "contacts_company_id_created_at_idx"
    ON "contacts"("company_id", "created_at");

-- Departments: índice em companyId (faltante desde a init)
CREATE INDEX IF NOT EXISTS "departments_company_id_idx"
    ON "departments"("company_id");

-- WorkflowRules: índice em companyId (faltante desde a init)
CREATE INDEX IF NOT EXISTS "workflow_rules_company_id_idx"
    ON "workflow_rules"("company_id");

-- InternalChatMessages: índice composto (chatId + sentAt) para histórico
CREATE INDEX IF NOT EXISTS "internal_chat_messages_chat_id_sent_at_idx"
    ON "internal_chat_messages"("chat_id", "sent_at");

-- Tickets: índice composto (companyId + status + createdAt) para dashboard
CREATE INDEX IF NOT EXISTS "tickets_company_id_status_created_at_idx"
    ON "tickets"("company_id", "status", "created_at");

-- Users: índice em companyId + isActive para listagem de agentes disponíveis
CREATE INDEX IF NOT EXISTS "users_company_id_is_active_idx"
    ON "users"("company_id", "is_active");

-- RefreshTokens: índice em userId para logout de todos os dispositivos
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx"
    ON "refresh_tokens"("user_id");

-- RefreshTokens: índice em expiresAt para limpeza de tokens expirados
CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx"
    ON "refresh_tokens"("expires_at");
