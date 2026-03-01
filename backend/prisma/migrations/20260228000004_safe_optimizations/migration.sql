-- Safe re-application of AI Optimization columns (idempotente via IF NOT EXISTS)
-- Garante que os campos criados em 20260228000003_ai_optimizations existam no banco,
-- mesmo que aquela migration tenha sido pulada por alguma razão.

-- Company: daily cost alert threshold
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "dailyCostAlertUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AIAgent: model downgrade flag + per-agent daily token limit
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "allowModelDowngrade" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "limitTokensPerDay" INTEGER NOT NULL DEFAULT 0;

-- Conversation: progressive summarization fields
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "summaryMessageCount" INTEGER NOT NULL DEFAULT 0;

-- Company: limitTokens total (estava apenas na migration init, mas garantimos aqui)
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "limitTokens" INTEGER NOT NULL DEFAULT 100000;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "limitTokensPerHour" INTEGER NOT NULL DEFAULT 10000;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "limitTokensPerDay" INTEGER NOT NULL DEFAULT 100000;
