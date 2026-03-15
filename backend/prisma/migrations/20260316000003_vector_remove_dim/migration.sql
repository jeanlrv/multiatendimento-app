-- Migration: Remove fixed dimension constraint from vector column
--
-- Antes: embedding vector(1024)  → rejeita qualquer embedding != 1024 dims
-- Depois: embedding vector        → aceita qualquer dimensão (multi-provider)
--
-- Motivo: o sistema suporta múltiplos providers de embedding com dimensões diferentes:
--   - Qwen text-embedding-v2     → 1024 dims
--   - native fastembed MiniLM    → 384 dims
--   - OpenAI text-embedding-3-sm → 1536 dims
--   - etc.
--
-- O índice HNSW requer dimensão fixa, portanto é removido junto.
-- A busca vetorial continua funcional via sequential scan (adequado para KBs < 500k chunks).
-- O filtro vector_dims(dc.embedding) = ${dim} na query garante compatibilidade entre dimensões.

-- 1. Remover índice HNSW (requer dimensão fixa — incompatível com multi-provider)
DROP INDEX IF EXISTS document_chunks_embedding_hnsw_idx;

-- 2. Remover constraint de dimensão da coluna embedding
--    Cast direto: vector(1024) é assignment-compatible com vector (sem dim)
ALTER TABLE document_chunks
  ALTER COLUMN embedding TYPE vector
  USING embedding::vector;
