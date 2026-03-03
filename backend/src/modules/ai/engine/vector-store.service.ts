import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { EmbeddingProviderFactory } from './embedding-provider.factory';

@Injectable()
export class VectorStoreService {
    private readonly logger = new Logger(VectorStoreService.name);

    /** Score mínimo de relevância. Chunks abaixo disso são descartados (evita contexto irrelevante). */
    private readonly MIN_SCORE_THRESHOLD = 0.3;

    // --- Query Embedding Cache ---
    /** SHA256(provider:model:text) → embedding, 24h TTL */
    private readonly embeddingCache = new Map<string, { embedding: number[]; expiresAt: number }>();
    private readonly EMBEDDING_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
    private readonly EMBEDDING_CACHE_LIMIT = 2000;

    // --- RAG Results Cache ---
    /** SHA256(knowledgeBaseId?:companyId:queryText) → results, 5min TTL */
    private readonly ragCache = new Map<string, { results: any[]; expiresAt: number }>();
    private readonly RAG_CACHE_TTL_MS = 5 * 60 * 1000; // 5min

    constructor(
        private embeddingFactory: EmbeddingProviderFactory,
    ) { }

    /**
     * Gera um embedding para um texto usando o provider configurado.
     * Resultado é cacheado por 24h para evitar chamadas repetidas à API.
     */
    async generateEmbedding(
        text: string,
        provider: string = 'openai',
        model?: string,
        apiKeyOverride?: string,
        baseUrlOverride?: string,
    ): Promise<number[]> {
        const cacheKey = createHash('sha256').update(`${provider}:${model ?? ''}:${text}`).digest('hex');
        const cached = this.embeddingCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.embedding;
        }

        const embeddings = this.embeddingFactory.createEmbeddings(provider, model, apiKeyOverride, baseUrlOverride);

        // Timeout: 60s para provider nativo (download do modelo no primeiro uso), 20s para outros
        const timeoutMs = provider === 'native' ? 60000 : 20000;
        const embedding = await Promise.race([
            embeddings.embedQuery(text),
            new Promise<number[]>((_, reject) =>
                setTimeout(() => reject(new Error(`Timeout gerando embedding (${provider}). O modelo pode estar demorando para carregar.`)), timeoutMs)
            )
        ]);

        // Evict LRU entry se cache cheio
        if (this.embeddingCache.size >= this.EMBEDDING_CACHE_LIMIT) {
            const firstKey = this.embeddingCache.keys().next().value;
            if (firstKey) this.embeddingCache.delete(firstKey);
        }
        this.embeddingCache.set(cacheKey, { embedding, expiresAt: Date.now() + this.EMBEDDING_CACHE_TTL_MS });
        return embedding;
    }

    /**
     * Invalida o cache de resultados RAG para uma base de conhecimento específica.
     * Chamado quando documentos são adicionados/removidos da base.
     */
    invalidateRagCache(knowledgeBaseId?: string, companyId?: string): void {
        if (!knowledgeBaseId && !companyId) {
            this.ragCache.clear();
            return;
        }
        const prefix = knowledgeBaseId ?? companyId!;
        for (const key of this.ragCache.keys()) {
            if (key.includes(prefix)) this.ragCache.delete(key);
        }
    }

    /**
     * Busca por similaridade semântica usando cosine similarity em JavaScript.
     * Não requer pgvector — funciona com embeddings JSON já armazenados no banco.
     *
     * @param prisma Instância do PrismaService
     * @param companyId Filtro de tenant
     * @param queryText Texto de busca
     * @param knowledgeBaseId Opcional: restringir a uma base específica
     * @param limit Quantidade de chunks a retornar
     * @param embeddingProvider Provider usado para gerar o embedding da query
     * @param embeddingModel Modelo de embedding
     * @param apiKeyOverride API key da empresa para o provider de embedding
     * @param baseUrlOverride Base URL da empresa (para Ollama/Azure)
     * @param language Idioma para FTS (ex: 'portuguese', 'english', 'spanish'). Default: 'portuguese'
     * @param scoreThreshold Score mínimo de relevância (0–1). Padrão: MIN_SCORE_THRESHOLD
     */
    async searchSimilarity(
        prisma: any,
        companyId: string,
        queryText: string,
        knowledgeBaseId?: string,
        limit: number = 5,
        embeddingProvider: string = 'openai',
        embeddingModel?: string,
        apiKeyOverride?: string,
        baseUrlOverride?: string,
        language: string = 'portuguese',
        scoreThreshold?: number,
    ): Promise<{ content: string; score: number; documentId: string; documentTitle?: string }[]> {
        const threshold = scoreThreshold ?? this.MIN_SCORE_THRESHOLD;

        // RAG cache key — não inclui apiKey por segurança
        const ragCacheKey = createHash('sha256')
            .update(`${knowledgeBaseId ?? companyId}:${queryText}:${limit}:${threshold}`)
            .digest('hex');
        const cachedRag = this.ragCache.get(ragCacheKey);
        if (cachedRag && cachedRag.expiresAt > Date.now()) {
            this.logger.debug('[VectorStore] RAG cache hit');
            return cachedRag.results;
        }

        let queryEmbedding: number[] | null = null;
        try {
            // 1. Tenta gerar embedding da query (fallback flexivo)
            queryEmbedding = await this.generateEmbedding(queryText, embeddingProvider, embeddingModel, apiKeyOverride, baseUrlOverride);
        } catch (err: any) {
            this.logger.warn(`[VectorStore] Falha ao gerar embedding da query: ${err.message}. RAG usará apenas FTS.`);
        }

        try {
            // Sanitiza o idioma para evitar SQL injection (só letras minúsculas)
            const safeLang = /^[a-z]+$/.test(language) ? language : 'portuguese';

            // 2. Busca candidatos usando Full-Text Search (TSVector) — nativo do Postgres
            // Funciona perfeitamente mesmo sem existir 'embedding' gerado (chunk.embedding IS NULL)
            let candidates: any[];

            if (knowledgeBaseId) {
                candidates = await prisma.$queryRaw`
                    WITH fts_results AS (
                      SELECT
                          chunk.id,
                          chunk.content,
                          chunk.embedding,
                          chunk."documentId",
                          doc.title as "documentTitle",
                          ts_rank_cd(
                              to_tsvector(${safeLang}::regconfig, chunk.content),
                              plainto_tsquery(${safeLang}::regconfig, ${queryText})
                          ) AS text_score
                      FROM document_chunks chunk
                      JOIN documents doc ON doc.id = chunk."documentId"
                      WHERE doc.status = 'READY'
                        AND doc."knowledgeBaseId" = ${knowledgeBaseId}
                    )
                    SELECT * FROM fts_results 
                    WHERE text_score > 0
                    ORDER BY text_score DESC
                    LIMIT 100;
                `;
            } else {
                candidates = await prisma.$queryRaw`
                    WITH fts_results AS (
                      SELECT
                          chunk.id,
                          chunk.content,
                          chunk.embedding,
                          chunk."documentId",
                          doc.title as "documentTitle",
                          ts_rank_cd(
                              to_tsvector(${safeLang}::regconfig, chunk.content),
                              plainto_tsquery(${safeLang}::regconfig, ${queryText})
                          ) AS text_score
                      FROM document_chunks chunk
                      JOIN documents doc ON doc.id = chunk."documentId"
                      JOIN knowledge_bases kb ON kb.id = doc."knowledgeBaseId"
                      WHERE doc.status = 'READY'
                        AND kb."companyId" = ${companyId}
                    )
                    SELECT * FROM fts_results 
                    WHERE text_score > 0
                    ORDER BY text_score DESC
                    LIMIT 100;
                `;
            }

            // 3. Fallback semântico: se FTS não devolver relevâncias válidas e existir queryEmbedding,
            // varrer TODOS os chunks vetorizados (aqui exigimos que chunk.embedding NOT NULL)
            if ((!candidates || candidates.length === 0) && queryEmbedding) {
                this.logger.debug('[VectorStore] FTS sem resultados exatos (> 0) — usando fallback semântico.');
                const rawChunks = await prisma.documentChunk.findMany({
                    where: {
                        document: {
                            status: 'READY',
                            knowledgeBase: knowledgeBaseId ? { id: knowledgeBaseId } : { companyId },
                        },
                        embedding: { not: null },
                    },
                    include: { document: { select: { title: true } } },
                    take: 500, // Limite de varredura massiva
                });
                candidates = rawChunks.map((c: any) => ({
                    ...c,
                    documentTitle: c.document.title,
                    text_score: 0,
                }));
            }

            // Se ainda não tiver resultados (FTS vazio e semântico pulado/vazio)
            if (!candidates || candidates.length === 0) return [];

            // 4. Calcula similaridade de cosseno combinada com FTS + Semântico
            // Chunks vindos do FTS que não tiverem embedding ganharão vector_score = 0, priorizando o `text_score`.
            const scoredChunks = candidates.map(chunk => {
                let vectorScore = 0;
                const chunkEmbedding = typeof chunk.embedding === 'string' ? JSON.parse(chunk.embedding) : chunk.embedding;
                if (queryEmbedding && chunkEmbedding && Array.isArray(chunkEmbedding)) {
                    vectorScore = cosineSimilarity(queryEmbedding, chunkEmbedding as number[]);
                }

                // Score = (FTS rank escalonado para peso 0.4) + (Cosine Similarity peso 0.6)
                // Se o vector for 0 (por falta de embedding), o rankText se salva.
                const finalScore = (chunk.text_score * 0.4) + (vectorScore * 0.6);

                return {
                    content: chunk.content as string,
                    score: finalScore,
                    documentId: chunk.documentId as string,
                    documentTitle: chunk.documentTitle as string | undefined,
                };
            });

            // 5. Ordena por score decrescente
            scoredChunks.sort((a, b) => b.score - a.score);

            // 6. Filtra chunks abaixo do threshold de relevância
            const relevant = scoredChunks.filter(r => r.score >= threshold);

            // 7. Deduplicação: remove chunks semanticamente similares entre si (>0.92)
            const deduplicated: typeof relevant = [];
            for (const candidate of relevant) {
                const isDuplicate = deduplicated.some(kept => {
                    // Compara pelo conteúdo normalizado (mais rápido que cosine em embeddings)
                    const similarity = contentOverlapRatio(kept.content, candidate.content);
                    return similarity > 0.85;
                });
                if (!isDuplicate) deduplicated.push(candidate);
                if (deduplicated.length >= limit) break;
            }

            this.logger.debug(
                `[VectorStore] ${candidates.length} candidatos → ${relevant.length} relevantes (>=${threshold}) → ${deduplicated.length} após dedup → Top ${Math.min(deduplicated.length, limit)}`
            );

            const results = deduplicated.slice(0, limit);
            this.ragCache.set(ragCacheKey, { results, expiresAt: Date.now() + this.RAG_CACHE_TTL_MS });
            return results;
        } catch (error) {
            this.logger.error(`Erro na busca híbrida por similaridade: ${error.message}`);
            return [];
        }
    }
}

/**
 * Similaridade de cosseno entre dois vetores.
 * Retorna 0 se vetores nulos ou de tamanhos diferentes.
 */
function cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;

    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dot / denominator;
}

/**
 * Ratio de sobreposição de conteúdo entre dois textos (bigrams).
 * Alternativa leve ao cosine similarity para deduplicação de chunks de texto.
 */
function contentOverlapRatio(a: string, b: string): number {
    if (!a || !b) return 0;
    const shorter = a.length < b.length ? a : b;
    const longer = a.length < b.length ? b : a;
    if (shorter.length === 0) return 0;
    // Verifica se o texto mais curto está contido no mais longo (substring match)
    if (longer.includes(shorter.trim())) return 1;
    // Bigram overlap
    const bigramsA = new Set(toBigrams(a));
    const bigramsB = new Set(toBigrams(b));
    let intersection = 0;
    for (const bg of bigramsA) { if (bigramsB.has(bg)) intersection++; }
    return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

function toBigrams(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    const bigrams: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
        bigrams.push(`${words[i]}_${words[i + 1]}`);
    }
    return bigrams;
}
