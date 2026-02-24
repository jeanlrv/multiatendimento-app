-- Migration: Enforce users.role_id NOT NULL
-- Garante que todos os usuários tenham um role antes de tornar a coluna obrigatória

-- Atribuir o primeiro role disponível (por companyId) aos usuários sem roleId
UPDATE users u
SET role_id = (
    SELECT r.id
    FROM roles r
    WHERE r.company_id = u.company_id
    ORDER BY r.created_at ASC
    LIMIT 1
)
WHERE u.role_id IS NULL
  AND EXISTS (
    SELECT 1 FROM roles r WHERE r.company_id = u.company_id
  );

-- Verificar se ainda restam usuários sem role (não deveria acontecer após seed)
DO $$
DECLARE
    orphan_count INT;
BEGIN
    SELECT COUNT(*) INTO orphan_count FROM users WHERE role_id IS NULL;
    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'Existem % usuários sem role_id. Execute o seed antes desta migration.', orphan_count;
    END IF;
END $$;

-- Enforçar a constraint NOT NULL
ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;
