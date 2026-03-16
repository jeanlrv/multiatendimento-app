-- AlterTable: add closingMessage to departments
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "closingMessage" TEXT;
