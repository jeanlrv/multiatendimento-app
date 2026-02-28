-- Migration: 20260228000001_provider_config
-- Adiciona tabela provider_configs para armazenar configurações de providers de IA por empresa

CREATE TABLE IF NOT EXISTS "provider_configs" (
    "id"          TEXT NOT NULL,
    "companyId"   TEXT NOT NULL,
    "provider"    TEXT NOT NULL,
    "category"    TEXT NOT NULL DEFAULT 'llm',
    "apiKey"      TEXT,
    "baseUrl"     TEXT,
    "extraConfig" JSONB,
    "isEnabled"   BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_configs_pkey" PRIMARY KEY ("id")
);

-- Chave estrangeira para company
ALTER TABLE "provider_configs"
    ADD CONSTRAINT "provider_configs_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS "provider_configs_companyId_provider_key"
    ON "provider_configs"("companyId", "provider");

CREATE INDEX IF NOT EXISTS "provider_configs_companyId_idx"
    ON "provider_configs"("companyId");
