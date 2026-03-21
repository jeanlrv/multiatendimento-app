-- Reparo: cria tabela document_chunks caso não exista no banco de produção.
-- Motivo: a migration 20260226000004 criou a tabela localmente, mas no Railway
-- ela pode não ter sido aplicada. As migrations 20260307 e 20260316 (pgvector)
-- alteram esta tabela e falhariam silenciosamente se ela não existir.
--
-- Estado final esperado:
--   id          TEXT PK
--   documentId  TEXT FK → documents(id) CASCADE
--   content     TEXT NOT NULL
--   pageNumber  INTEGER
--   section     TEXT          (adicionado em 20260307000001)
--   metadata    JSONB
--   embedding   vector        (sem dimensão fixa — suporta múltiplos providers)

-- 1. Habilita pgvector (seguro se já habilitado; silencioso se não disponível)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector não disponível (%). Embedding usará fallback JS.', SQLERRM;
END$$;

-- 2. Cria a tabela somente se ainda não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'document_chunks'
    ) THEN
        -- Tenta criar com tipo vector (pgvector disponível)
        BEGIN
            EXECUTE '
                CREATE TABLE "document_chunks" (
                    "id"         TEXT NOT NULL,
                    "documentId" TEXT NOT NULL,
                    "content"    TEXT NOT NULL,
                    "pageNumber" INTEGER,
                    "section"    TEXT,
                    "metadata"   JSONB,
                    "embedding"  vector,
                    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
                )
            ';
            RAISE NOTICE 'Tabela document_chunks criada com coluna embedding vector.';
        EXCEPTION WHEN OTHERS THEN
            -- pgvector não disponível: cria com jsonb como fallback
            EXECUTE '
                CREATE TABLE "document_chunks" (
                    "id"         TEXT NOT NULL,
                    "documentId" TEXT NOT NULL,
                    "content"    TEXT NOT NULL,
                    "pageNumber" INTEGER,
                    "section"    TEXT,
                    "metadata"   JSONB,
                    "embedding"  JSONB,
                    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
                )
            ';
            RAISE NOTICE 'Tabela document_chunks criada com coluna embedding JSONB (sem pgvector).';
        END;
    ELSE
        RAISE NOTICE 'Tabela document_chunks já existe — verificando colunas.';
    END IF;
END$$;

-- 3. Garante FK para documents (idempotente)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'document_chunks_documentId_fkey'
          AND table_name      = 'document_chunks'
    ) THEN
        ALTER TABLE "document_chunks"
            ADD CONSTRAINT "document_chunks_documentId_fkey"
            FOREIGN KEY ("documentId") REFERENCES "documents"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- 4. Garante coluna section (pode já existir se 20260307 rodou antes)
ALTER TABLE "document_chunks" ADD COLUMN IF NOT EXISTS "section" TEXT;

-- 5. Garante índice no documentId
CREATE INDEX IF NOT EXISTS "document_chunks_documentId_idx"
    ON "document_chunks"("documentId");

-- 6. Se embedding ainda for JSONB (pgvector disponível agora), converte para vector
DO $$
DECLARE
    col_type TEXT;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'document_chunks'
      AND column_name  = 'embedding';

    IF col_type = 'jsonb' THEN
        BEGIN
            -- Converte JSONB → vector (sem dimensão fixa, suporta multi-provider)
            EXECUTE '
                ALTER TABLE document_chunks
                    ALTER COLUMN embedding TYPE vector
                    USING CASE
                        WHEN embedding IS NULL THEN NULL
                        ELSE embedding::text::vector
                    END
            ';
            RAISE NOTICE 'Coluna embedding convertida de JSONB para vector.';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Não foi possível converter embedding para vector (%); mantendo JSONB.', SQLERRM;
        END;
    END IF;
END$$;

-- 7. Remove índice HNSW com dimensão fixa, se existir de migration anterior
DROP INDEX IF EXISTS document_chunks_embedding_hnsw_idx;
