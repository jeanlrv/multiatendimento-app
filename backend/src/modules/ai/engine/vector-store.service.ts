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

            // Transforma o array em string no formato que o pgvector aceita '[0.1, 0.2, ...]'
            const embeddingStr = `[${queryEmbedding.join(',')}]`;

            // 2. Monta a busca híbrida.
            // A buscar vetorial usa o operador de cosseno <=>. 
            // A busca full-text ts_rank_cd usa plainto_tsquery combinando ambos os scores.
            let results: any[];

            if (knowledgeBaseId) {
                // Filtro para Base de Conhecimento Específica
                results = await prisma.$queryRaw`
                    WITH vector_search AS (
                        SELECT 
                            chunk.id,
                            chunk.content,
                            chunk."documentId",
                            doc.title,
                            (1 - (chunk.embedding <=> ${embeddingStr}::vector)) AS vector_score,
                            ts_rank_cd(to_tsvector('portuguese', chunk.content), plainto_tsquery('portuguese', ${queryText})) AS text_score
                        FROM document_chunks chunk
                        JOIN documents doc ON doc.id = chunk."documentId"
                        WHERE doc.status = 'READY'
                          AND doc."knowledgeBaseId" = ${knowledgeBaseId}
                          AND chunk.embedding IS NOT NULL
                    )
                    SELECT 
                        id, content, "documentId", title as "documentTitle",
                        (0.7 * vector_score) + (0.3 * text_score) AS score
                    FROM vector_search
                    ORDER BY score DESC
                    LIMIT 20;
                `;
            } else {
                // Filtro apenas por CompanyId (qualquer base da empresa)
                results = await prisma.$queryRaw`
                    WITH vector_search AS (
                        SELECT 
                            chunk.id,
                            chunk.content,
                            chunk."documentId",
                            doc.title,
                            (1 - (chunk.embedding <=> ${embeddingStr}::vector)) AS vector_score,
                            ts_rank_cd(to_tsvector('portuguese', chunk.content), plainto_tsquery('portuguese', ${queryText})) AS text_score
                        FROM document_chunks chunk
                        JOIN documents doc ON doc.id = chunk."documentId"
                        JOIN knowledge_bases kb ON kb.id = doc."knowledgeBaseId"
                        WHERE doc.status = 'READY'
                          AND kb."companyId" = ${companyId}
                          AND chunk.embedding IS NOT NULL
                    )
                    SELECT 
                        id, content, "documentId", title as "documentTitle",
                        (0.7 * vector_score) + (0.3 * text_score) AS score
                    FROM vector_search
                    ORDER BY score DESC
                    LIMIT 20;
                `;
            }

            if (!results || results.length === 0) {
                this.logger.debug('Nenhum chunk encontrado na busca híbrida.');
                return [];
            }

            // 3. Fase 2: Re-ranking Inteligente
            // Opcionalmente podemos aplicar um modelo Bi-Encoder aqui, mas como temos 
            // a métrica bruta combinada forte, refinamos o Top-K exato
            results.sort((a, b) => b.score - a.score);
            const topResults = results.slice(0, limit).map(row => ({
                content: row.content,
                score: row.score,
                documentId: row.documentId,
                documentTitle: row.documentTitle,
            }));

            this.logger.debug(
                `Hybrid Search pgvector: query resultou em ${results.length} chunks extraídos, re-rank mantendo Top ${topResults.length} (score máx: ${topResults[0]?.score?.toFixed(4) ?? 'N/A'})`
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
