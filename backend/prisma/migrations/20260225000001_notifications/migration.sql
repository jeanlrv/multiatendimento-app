-- Migration: 20260225000001_notifications
-- Cria tabela de notificações persistentes para inbox do usuário

CREATE TABLE "notifications" (
    "id"          TEXT         NOT NULL DEFAULT gen_random_uuid(),
    "user_id"     TEXT         NOT NULL,
    "company_id"  TEXT         NOT NULL,
    "type"        TEXT         NOT NULL,
    "title"       TEXT         NOT NULL,
    "body"        TEXT,
    "entity_type" TEXT,
    "entity_id"   TEXT,
    "read_at"     TIMESTAMP(3),
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- FK: user_id → users.id (cascade delete)
ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Índices de performance
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");
CREATE INDEX "notifications_company_id_idx"       ON "notifications"("company_id");
CREATE INDEX "notifications_created_at_idx"       ON "notifications"("created_at");
