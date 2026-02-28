import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingProviderFactory } from './embedding-provider.factory';

@Injectable()
export class VectorStoreService {
    private readonly logger = new Logger(VectorStoreService.name);

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
    ): Promise<{ content: string; score: number; documentId: string; documentTitle?: string }[]> {
        try {
            // 1. Gera embedding da query
            const queryEmbedding = await this.generateEmbedding(queryText, embeddingProvider, embeddingModel, apiKeyOverride, baseUrlOverride);

            // 2. Busca candidatos usando Full-Text Search (TSVector) - nativo do Postgres
            // Recuperamos o conteúdo e o embedding JSON para cálculo em RAM
            let candidates: any[];

            if (knowledgeBaseId) {
                candidates = await prisma.$queryRaw`
                    SELECT 
                        chunk.id,
                        chunk.content,
                        chunk.embedding,
                        chunk."documentId",
                        doc.title as "documentTitle",
                        ts_rank_cd(to_tsvector('portuguese', chunk.content), plainto_tsquery('portuguese', ${queryText})) AS text_score
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
                        ts_rank_cd(to_tsvector('portuguese', chunk.content), plainto_tsquery('portuguese', ${queryText})) AS text_score
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

            if (!candidates || candidates.length === 0) {
                // Se o FTS não achar nada, tentamos pegar os últimos 50 chunks como fallback desesperado
                candidates = await prisma.documentChunk.findMany({
                    where: {
                        document: {
                            status: 'READY',
                            knowledgeBase: knowledgeBaseId ? { id: knowledgeBaseId } : { companyId },
                        },
                        NOT: { embedding: null }
                    },
                    include: { document: { select: { title: true } } },
                    take: 50,
                    orderBy: { id: 'desc' }
                });

                // Normalizar formato do findMany para o esperado pelo map abaixo
                candidates = candidates.map(c => ({
                    ...c,
                    documentTitle: c.document.title,
                    text_score: 0
                }));
            }

            // 3. Calcula similaridade de cosseno em Node.js para os candidatos
            const results = candidates.map(c => {
                const chunkEmbedding = typeof c.embedding === 'string' ? JSON.parse(c.embedding) : c.embedding;
                const vectorScore = cosineSimilarity(queryEmbedding, chunkEmbedding as number[]);

                // Score híbrido: 70% vetorial + 30% textual
                const hybridScore = (0.7 * vectorScore) + (0.3 * (c.text_score || 0));

                return {
                    content: c.content,
                    score: hybridScore,
                    documentId: c.documentId,
                    documentTitle: c.documentTitle,
                };
            });

            // 4. Ordenação final e Limite
            results.sort((a, b) => b.score - a.score);
            const topResults = results.slice(0, limit);

            this.logger.debug(
                `Hybrid Search (Fallback Node.js): Analisados ${candidates.length} candidatos, retornando Top ${topResults.length} (score máx: ${topResults[0]?.score?.toFixed(4) ?? 'N/A'})`
            );

            return topResults;
        } catch (error) {
            this.logger.error(`Erro na busca híbrida por similaridade: ${error.message}`);
            return [];
        }
    }
}

/**
 * Calcula a similaridade de cosseno entre dois vetores.
 * Retorna valor entre -1 e 1 (1 = idênticos, 0 = ortogonais, -1 = opostos).
 */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dot / denominator;
}
