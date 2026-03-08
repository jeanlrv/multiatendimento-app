-- Corrige defaults de limitTokensPerHour e limitTokensPerDay para 0 (ilimitado)
-- Empresas que ainda têm os valores antigos (10000/hora ou 100000/dia) são zeradas,
-- pois o default agora é 0 = ilimitado e os limites devem ser opt-in.
-- Nota: a tabela é "companies" (@@map no schema Prisma), não "Company".

ALTER TABLE "companies" ALTER COLUMN "limitTokens" SET DEFAULT 0;
ALTER TABLE "companies" ALTER COLUMN "limitTokensPerHour" SET DEFAULT 0;
ALTER TABLE "companies" ALTER COLUMN "limitTokensPerDay" SET DEFAULT 0;

-- Zera empresas que ainda têm os antigos defaults (nunca foram ajustadas pelo admin)
UPDATE "companies"
SET
  "limitTokensPerHour" = 0,
  "limitTokensPerDay"  = 0
WHERE "limitTokensPerHour" = 10000
   OR "limitTokensPerDay"  = 100000;
