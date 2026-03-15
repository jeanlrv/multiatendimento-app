-- Corrige roles existentes que não têm permissões de clientes
-- (adicionadas ao enum Permission mas ausentes no seed original)

-- Perfis Admin/Supervisor (têm contacts:delete) → CRUD completo em customers
UPDATE "roles"
SET permissions = array(
    SELECT DISTINCT unnest(
        permissions ||
        ARRAY['customers:read','customers:create','customers:update','customers:delete']
    )
)
WHERE 'contacts:delete' = ANY(permissions)
  AND NOT ('customers:read' = ANY(permissions));

-- Perfis Atendente/Agente (têm contacts:update mas NÃO contacts:delete) → read+update
UPDATE "roles"
SET permissions = array(
    SELECT DISTINCT unnest(
        permissions ||
        ARRAY['customers:read','customers:update']
    )
)
WHERE 'contacts:update' = ANY(permissions)
  AND NOT ('contacts:delete' = ANY(permissions))
  AND NOT ('customers:read' = ANY(permissions));
