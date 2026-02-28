-- AI Optimizations: model routing, progressive summarization, cost alerts, per-agent limits

-- Company: daily cost alert threshold
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "dailyCostAlertUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AIAgent: model downgrade flag + per-agent daily token limit
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "allowModelDowngrade" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "limitTokensPerDay" INTEGER NOT NULL DEFAULT 0;

-- Conversation: progressive summarization fields
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "summaryMessageCount" INTEGER NOT NULL DEFAULT 0;
