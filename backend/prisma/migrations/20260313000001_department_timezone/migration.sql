-- AddColumn: timezone to departments
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';
