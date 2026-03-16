-- AddColumn publicToken ao model Ticket
-- Token público opaco para acesso ao portal do cliente sem expor o ID interno do ticket

ALTER TABLE "tickets" ADD COLUMN "publicToken" TEXT;

-- Preencher publicToken para tickets existentes com UUID gerado
UPDATE "tickets" SET "publicToken" = gen_random_uuid()::text WHERE "publicToken" IS NULL;

-- Tornar obrigatório e único após preencher os valores existentes
ALTER TABLE "tickets" ALTER COLUMN "publicToken" SET NOT NULL;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_publicToken_key" UNIQUE ("publicToken");
