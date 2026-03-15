-- Add CSAT tracking columns to contacts
-- csatPending: true while waiting for customer to respond to CSAT request
-- csatTicketId: links back to the ticket that triggered the CSAT

ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "csatPending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "csatTicketId" TEXT;
