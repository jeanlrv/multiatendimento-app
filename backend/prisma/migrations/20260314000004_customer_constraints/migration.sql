-- B1: Partial unique index on (companyId, phonePrimary) — only when phonePrimary IS NOT NULL
-- Prevents duplicate customers with the same phone in the same company
CREATE UNIQUE INDEX "customers_company_phone_unique"
  ON "customers" ("companyId", "phonePrimary")
  WHERE "phonePrimary" IS NOT NULL;

-- B2: Unique constraint on (customerId, fieldName) to prevent duplicate custom fields
ALTER TABLE "customer_custom_fields"
  ADD CONSTRAINT "customer_custom_fields_customerId_fieldName_key"
  UNIQUE ("customerId", "fieldName");

-- Index to support lookup by companyId + phonePrimary
CREATE INDEX "customers_companyId_phonePrimary_idx"
  ON "customers" ("companyId", "phonePrimary");
