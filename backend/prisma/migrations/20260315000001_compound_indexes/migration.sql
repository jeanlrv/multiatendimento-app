-- Compound indexes for performance (multi-tenant filtered queries)

-- tickets: date-range queries (getHistory, reports)
CREATE INDEX IF NOT EXISTS "tickets_company_id_created_at_idx" ON "tickets"("company_id", "created_at");

-- tickets: agent filtering (getStats, getAgentRanking with assignedUserId filter)
CREATE INDEX IF NOT EXISTS "tickets_company_id_assigned_user_id_idx" ON "tickets"("company_id", "assigned_user_id");

-- contacts: webhook / import lookups by phone within a company (was N+1)
CREATE INDEX IF NOT EXISTS "contacts_company_id_phone_number_idx" ON "contacts"("company_id", "phone_number");

-- messages: paginated message list ordered by time (chat view)
CREATE INDEX IF NOT EXISTS "messages_ticket_id_sent_at_idx" ON "messages"("ticket_id", "sent_at");
