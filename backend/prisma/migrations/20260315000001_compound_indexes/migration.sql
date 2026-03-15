-- Compound indexes for performance (multi-tenant filtered queries)
-- Note: columns use camelCase (no @map on individual fields in schema)

-- tickets: date-range queries (getHistory, reports)
CREATE INDEX IF NOT EXISTS "tickets_company_id_created_at_idx" ON "tickets"("companyId", "createdAt");

-- tickets: agent filtering (getStats, getAgentRanking with assignedUserId filter)
CREATE INDEX IF NOT EXISTS "tickets_company_id_assigned_user_id_idx" ON "tickets"("companyId", "assignedUserId");

-- contacts: webhook / import lookups by phone within a company
CREATE INDEX IF NOT EXISTS "contacts_company_id_phone_number_idx" ON "contacts"("companyId", "phoneNumber");

-- messages: (ticketId, sentAt) already created in 20260222000003 — skipped
