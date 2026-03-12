-- Adiciona zapiClientToken e departmentIds à tabela whatsapp_instances
-- zapiClientToken: Client-Token de segurança Z-API (Security Token), por conexão
-- departmentIds:   array de IDs de departamentos vinculados (múltiplos departamentos)

ALTER TABLE "whatsapp_instances"
  ADD COLUMN IF NOT EXISTS "zapiClientToken" TEXT,
  ADD COLUMN IF NOT EXISTS "departmentIds"   TEXT[] NOT NULL DEFAULT '{}';

-- Migra departmentId existente para o novo array (preserva retrocompatibilidade)
UPDATE "whatsapp_instances"
  SET "departmentIds" = ARRAY["departmentId"]
  WHERE "departmentId" IS NOT NULL AND array_length("departmentIds", 1) IS NULL;
