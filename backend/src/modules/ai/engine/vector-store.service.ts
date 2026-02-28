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

            // 2. Busca todos os chunks com embedding disponível
            const whereClause: any = {
                document: {
                    status: 'READY',
                    knowledgeBase: { companyId },
                },
                embedding: { not: null },
            };

            if (knowledgeBaseId) {
                whereClause.document = {
                    ...whereClause.document,
                    knowledgeBaseId,
                };
            }

            const chunks = await prisma.documentChunk.findMany({
                where: whereClause,
                select: {
                    id: true,
                    content: true,
                    embedding: true,
                    documentId: true,
                    document: { select: { title: true } },
                },
            });

            if (chunks.length === 0) {
                this.logger.debug('Nenhum chunk encontrado para busca de similaridade.');
                return [];
            }

            // 3. Calcula cosine similarity para cada chunk
            const scored = chunks
                .map((chunk: any) => {
                    const chunkEmbedding = chunk.embedding as number[];
                    if (!chunkEmbedding || !Array.isArray(chunkEmbedding) || chunkEmbedding.length === 0) {
                        return null;
                    }
                    const score = cosineSimilarity(queryEmbedding, chunkEmbedding);
                    return {
                        content: chunk.content,
                        score,
                        documentId: chunk.documentId,
                        documentTitle: chunk.document?.title,
                    };
                })
                .filter((c): c is { content: string; score: number; documentId: string; documentTitle: string | undefined } => c !== null && !isNaN(c.score));

            // 4. Ordena por score decrescente e retorna top N
            scored.sort((a, b) => b.score - a.score);
            const results = scored.slice(0, limit);

            this.logger.debug(
                `Busca vetorial: ${chunks.length} chunks avaliados, top ${results.length} retornados (score máx: ${results[0]?.score?.toFixed(4) ?? 'N/A'})`,
            );

            return results;
        } catch (error) {
            this.logger.error(`Erro na busca por similaridade: ${error.message}`);
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
