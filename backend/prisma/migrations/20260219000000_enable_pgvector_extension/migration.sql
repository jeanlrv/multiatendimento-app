-- Migration: 20260226000001_enable_pgvector_extension
-- Habilita a extensão pgvector para suporte a embeddings vetoriais
-- Necessário para funcionalidades de IA e RAG (Retrieval-Augmented Generation)
-- Habilitar extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;
-- Verificar se a extensão foi criada com sucesso
COMMENT ON EXTENSION vector IS 'vector data type for pgvector';