-- Migration: Enforce users.roleId NOT NULL
-- Garante que todos os usuários tenham um role antes de tornar a coluna obrigatória
-- Atribuir o primeiro role disponível (por companyId) aos usuários sem roleId
UPDATE users u
SET "roleId" = (
    SELECT r.id
    FROM roles r
    WHERE r."companyId" = u."companyId"
    ORDER BY r."createdAt" ASC
    LIMIT 1
  )
WHERE u."roleId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM roles r
    WHERE r."companyId" = u."companyId"
  );
-- Verificar se ainda restam usuários sem role (não deveria acontecer após seed)
DO $$
DECLARE orphan_count INT;
BEGIN
SELECT COUNT(*) INTO orphan_count
FROM users
WHERE "roleId" IS NULL;
IF orphan_count > 0 THEN RAISE EXCEPTION 'Existem % usuários sem roleId. Execute o seed antes desta migration.',
orphan_count;
END IF;
END $$;
-- Enforçar a constraint NOT NULL
ALTER TABLE users
ALTER COLUMN "roleId"
SET NOT NULL;