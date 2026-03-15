-- Migration: Converte coluna embedding de jsonb para tipo vector(1024) nativo do pgvector
-- e adiciona índice HNSW para busca ANN (Approximate Nearest Neighbor).
--
-- Antes: embedding jsonb       → full sequential scan, cast por linha, json_array_length quebrado
-- Depois: embedding vector(1024) → HNSW index, 1-3ms para 1M+ chunks, operador <=> nativo
--
-- Dimensão 1024: padrão do Qwen text-embedding-v2 (provider padrão do sistema).
-- Para mudar de provider/modelo, os chunks precisam ser re-vetorizados com mesma dimensão.

-- 1. Converter coluna de jsonb para vector(1024) nativo
--    A expressão embedding::text::vector(1024) interpreta o JSON array como vector de 1024 dims.
--    Chunks NULL permanecem NULL (documentos sem embedding usam FTS fallback).
ALTER TABLE document_chunks
  ALTER COLUMN embedding TYPE vector(1024)
  USING CASE
    WHEN embedding IS NULL THEN NULL
    ELSE embedding::text::vector(1024)
  END;

-- 2. Índice HNSW para busca vetorial aproximada por similaridade de cosseno
--    Requer dimensão fixa na coluna (garantida pelo vector(1024) acima).
--    m=16           → número de conexões por nó no grafo (padrão pgvector)
--    ef_construction=64 → profundidade de busca durante construção (qualidade vs velocidade)
--    vector_cosine_ops  → métrica de distância: 1 - cosine_similarity
CREATE INDEX document_chunks_embedding_hnsw_idx
  ON document_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
