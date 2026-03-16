-- AlterTable: add scheduledAt to Broadcast
ALTER TABLE "broadcasts" ADD COLUMN "scheduledAt" TIMESTAMP(3);
