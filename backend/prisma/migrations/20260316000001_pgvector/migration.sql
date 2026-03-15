-- Migration: Habilita extensão pgvector para busca semântica no banco
-- A extensão permite calcular distância cosseno (<=>) no PostgreSQL.
--
-- Usa DO block para não quebrar se o ambiente não tiver pgvector instalado
-- (ex: Railway PG17 sem a extensão, ou ambientes de CI).

DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector não disponível neste servidor (%). Busca vetorial usará fallback JS.', SQLERRM;
END$$;
