-- Migration: 20260222000003_indexes_columns_fixes
-- Corrige índices faltantes e colunas ausentes identificados na análise técnica de 22/02/2026
-- ─────────────────────────────────────────────────────────────
-- 1. Coluna contact.information (ausente na migration inicial)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "contacts"
ADD COLUMN IF NOT EXISTS "information" TEXT;
-- ─────────────────────────────────────────────────────────────
-- 2. companyId em audit_logs (multi-tenancy)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "audit_logs"
ADD COLUMN IF NOT EXISTS "companyId" TEXT;
-- Preencher companyId retroativamente via userId → users.companyId
UPDATE "audit_logs" al
SET "companyId" = u."companyId"
FROM "users" u
WHERE al."userId" = u."id"
    AND al."companyId" IS NULL;
CREATE INDEX IF NOT EXISTS "audit_logs_company_id_idx" ON "audit_logs"("companyId");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("createdAt");
-- ─────────────────────────────────────────────────────────────
-- 3. Índices de performance faltantes
-- ─────────────────────────────────────────────────────────────
-- Messages: índice composto (ticketId + sentAt) para histórico paginado
CREATE INDEX IF NOT EXISTS "messages_ticket_id_sent_at_idx" ON "messages"("ticketId", "sentAt");
-- Messages: índice isolado em sentAt para queries de período
CREATE INDEX IF NOT EXISTS "messages_sent_at_idx" ON "messages"("sentAt");
-- Contacts: índice em createdAt para relatórios de novos contatos
CREATE INDEX IF NOT EXISTS "contacts_created_at_idx" ON "contacts"("createdAt");
-- Contacts: índice composto (companyId + createdAt) para filtros + período
CREATE INDEX IF NOT EXISTS "contacts_company_id_created_at_idx" ON "contacts"("companyId", "createdAt");
-- Departments: índice em companyId (faltante desde a init)
CREATE INDEX IF NOT EXISTS "departments_company_id_idx" ON "departments"("companyId");
-- WorkflowRules: índice em companyId (faltante desde a init)
CREATE INDEX IF NOT EXISTS "workflow_rules_company_id_idx" ON "workflow_rules"("companyId");
-- InternalChatMessages: índice composto (chatId + sentAt) para histórico
CREATE INDEX IF NOT EXISTS "internal_chat_messages_chat_id_sent_at_idx" ON "internal_chat_messages"("chatId", "sentAt");
-- Tickets: índice composto (companyId + status + createdAt) para dashboard
CREATE INDEX IF NOT EXISTS "tickets_company_id_status_created_at_idx" ON "tickets"("companyId", "status", "createdAt");
-- Users: índice em companyId + isActive para listagem de agentes disponíveis
CREATE INDEX IF NOT EXISTS "users_company_id_is_active_idx" ON "users"("companyId", "isActive");
-- RefreshTokens: índice em userId para logout de todos os dispositivos
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens"("userId");
-- RefreshTokens: índice em expiresAt para limpeza de tokens expirados
CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expiresAt");