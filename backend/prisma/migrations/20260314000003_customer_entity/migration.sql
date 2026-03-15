-- ============================================
-- MIGRATION: Customer entity (mini-CRM)
-- ============================================

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('PERSON', 'COMPANY');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('LEAD', 'ACTIVE', 'INACTIVE');

-- CreateTable: customers
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL DEFAULT 'PERSON',
    "cpfCnpj" TEXT,
    "emailPrimary" TEXT,
    "phonePrimary" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "origin" TEXT,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: customer_tags
CREATE TABLE "customer_tags" (
    "customerId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "customer_tags_pkey" PRIMARY KEY ("customerId","tagId")
);

-- CreateTable: customer_notes
CREATE TABLE "customer_notes" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: customer_custom_fields
CREATE TABLE "customer_custom_fields" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "fieldValue" TEXT,
    "fieldType" TEXT NOT NULL DEFAULT 'text',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_custom_fields_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add customerId to contacts (nullable — retrocompatível)
ALTER TABLE "contacts" ADD COLUMN "customerId" TEXT;

-- CreateIndex
CREATE INDEX "customers_companyId_idx" ON "customers"("companyId");
CREATE INDEX "customers_companyId_status_idx" ON "customers"("companyId", "status");
CREATE INDEX "customer_notes_customerId_idx" ON "customer_notes"("customerId");
CREATE INDEX "customer_custom_fields_customerId_idx" ON "customer_custom_fields"("customerId");

-- AddForeignKey: customers → companies
ALTER TABLE "customers" ADD CONSTRAINT "customers_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: customer_tags → customers
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: customer_tags → tags
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: customer_notes → customers
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: customer_notes → users
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: customer_custom_fields → customers
ALTER TABLE "customer_custom_fields" ADD CONSTRAINT "customer_custom_fields_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: contacts → customers (nullable)
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- DATA MIGRATION: Create Customer for each existing Contact
-- Garante retrocompatibilidade: todos os contatos recebem um customer automaticamente
-- ============================================
DO $$
DECLARE
    r RECORD;
    new_customer_id TEXT;
BEGIN
    FOR r IN SELECT * FROM "contacts" WHERE "customerId" IS NULL LOOP
        INSERT INTO "customers" (
            "id", "name", "emailPrimary", "phonePrimary", "notes",
            "companyId", "createdAt", "updatedAt"
        ) VALUES (
            gen_random_uuid()::text,
            COALESCE(r."name", r."phoneNumber"),
            r."email",
            r."phoneNumber",
            r."notes",
            r."companyId",
            r."createdAt",
            r."updatedAt"
        ) RETURNING "id" INTO new_customer_id;

        UPDATE "contacts" SET "customerId" = new_customer_id WHERE "id" = r."id";
    END LOOP;
END $$;
