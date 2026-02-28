import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingProviderFactory } from './embedding-provider.factory';

@Injectable()
export class VectorStoreService {
    private readonly logger = new Logger(VectorStoreService.name);

    /** Score mínimo de relevância. Chunks abaixo disso são descartados (evita contexto irrelevante). */
    private readonly MIN_SCORE_THRESHOLD = 0.3;

    constructor(
        private embeddingFactory: EmbeddingProviderFactory,
    ) { }

    /**
     * Gera um embedding para um texto usando o provider configurado.
     */
    async generateEmbedding(
        text: string,
        provider: string = 'openai',
        model?: string,
        apiKeyOverride?: string,
        baseUrlOverride?: string,
    ): Promise<number[]> {
        const embeddings = this.embeddingFactory.createEmbeddings(provider, model, apiKeyOverride, baseUrlOverride);
        return embeddings.embedQuery(text);
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
        try {
            // 1. Gera embedding da query
            const queryEmbedding = await this.generateEmbedding(queryText, embeddingProvider, embeddingModel, apiKeyOverride, baseUrlOverride);

            // Sanitiza o idioma para evitar SQL injection (só letras minúsculas)
            const safeLang = /^[a-z]+$/.test(language) ? language : 'portuguese';

            // 2. Busca candidatos usando Full-Text Search (TSVector) — nativo do Postgres
            let candidates: any[];

            if (knowledgeBaseId) {
                candidates = await prisma.$queryRaw`
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
                      AND chunk.embedding IS NOT NULL
                    ORDER BY text_score DESC
                    LIMIT 100;
                `;
            } else {
                candidates = await prisma.$queryRaw`
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
                      AND chunk.embedding IS NOT NULL
                    ORDER BY text_score DESC
                    LIMIT 100;
                `;
            }

            // 3. Fallback semântico: se FTS retornar vazio, varrer TODOS os chunks por cosine similarity
            if (!candidates || candidates.length === 0) {
                this.logger.debug('[VectorStore] FTS sem resultados — usando fallback semântico completo');
                const rawChunks = await prisma.documentChunk.findMany({
                    where: {
                        document: {
                            status: 'READY',
                            knowledgeBase: knowledgeBaseId ? { id: knowledgeBaseId } : { companyId },
                        },
                        NOT: { embedding: null },
                    },
                    include: { document: { select: { title: true } } },
                    // Sem orderBy arbitrário — a ordenação será pelo vectorScore abaixo
                });
                candidates = rawChunks.map((c: any) => ({
                    ...c,
                    documentTitle: c.document.title,
                    text_score: 0,
                }));
            }

            // 4. Calcula similaridade de cosseno em Node.js
            const scored = candidates.map((c: any) => {
                const chunkEmbedding = typeof c.embedding === 'string' ? JSON.parse(c.embedding) : c.embedding;
                const vectorScore = cosineSimilarity(queryEmbedding, chunkEmbedding as number[]);
                const hybridScore = (0.7 * vectorScore) + (0.3 * (c.text_score || 0));
                return {
                    content: c.content as string,
                    score: hybridScore,
                    documentId: c.documentId as string,
                    documentTitle: c.documentTitle as string | undefined,
                };
            });

            // 5. Ordena por score decrescente
            scored.sort((a, b) => b.score - a.score);

            // 6. Filtra chunks abaixo do threshold de relevância
            const relevant = scored.filter(r => r.score >= threshold);

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

            return deduplicated.slice(0, limit);
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
