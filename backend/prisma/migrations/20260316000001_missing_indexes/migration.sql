-- Migration: índices compostos ausentes
-- Melhora performance de: filtro de mensagens por origem em tickets,
-- e filtragem de contatos por cliente (customerId).

-- Índice composto para filtrar mensagens de IA em um ticket específico
-- Ex: WHERE ticketId = X AND origin = 'AI'
CREATE INDEX IF NOT EXISTS "messages_ticket_origin_idx"
    ON "messages" ("ticketId", "origin");

-- Índice composto para buscar contatos de uma empresa por cliente vinculado
-- Ex: WHERE companyId = X AND customerId = Y
CREATE INDEX IF NOT EXISTS "contacts_company_customer_idx"
    ON "contacts" ("companyId", "customerId");
