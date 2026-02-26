import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

@Injectable()
export class VectorStoreService {
    private readonly logger = new Logger(VectorStoreService.name);
    private embeddings: OpenAIEmbeddings;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
    ) {
        this.embeddings = new OpenAIEmbeddings({
            openAIApiKey: this.configService.get<string>('OPENAI_API_KEY'),
            modelName: 'text-embedding-3-small',
        });
    }

    /**
     * Gera um embedding para um texto.
     */
    async generateEmbedding(text: string): Promise<number[]> {
        return this.embeddings.embedQuery(text);
    }

    /**
     * Realiza busca por similaridade semântica (Cosseno) no pgvector.
     * @param companyId Filtro de tenant
     * @param queryText Texto de pesquisa do usuário
     * @param knowledgeBaseId Opcional: restringir a uma base específica
     * @param limit Quantidade de chunks a recuperar
     */
    async searchSimilarity(
        companyId: string,
        queryText: string,
        knowledgeBaseId?: string,
        limit: number = 3,
    ): Promise<any[]> {
        try {
            const vector = await this.generateEmbedding(queryText);
            const vectorString = `[${vector.join(',')}]`;

            // Query parametrizada para pgvector (similaridade de cosseno)
            let results: any[];

            if (knowledgeBaseId) {
                results = await (this.prisma as any).$queryRaw`
                    SELECT 
                        dc.content, 
                        dc."metadata",
                        d.title as "documentTitle",
                        1 - (dc.embedding <=> ${vectorString}::vector) as similarity
                    FROM document_chunks dc
                    JOIN documents d ON dc."documentId" = d.id
                    JOIN knowledge_bases kb ON d."knowledgeBaseId" = kb.id
                    WHERE kb."companyId" = ${companyId}
                    AND d.status = 'READY'
                    AND kb.id = ${knowledgeBaseId}
                    ORDER BY dc.embedding <=> ${vectorString}::vector
                    LIMIT ${limit};
                `;
            } else {
                results = await (this.prisma as any).$queryRaw`
                    SELECT 
                        dc.content, 
                        dc."metadata",
                        d.title as "documentTitle",
                        1 - (dc.embedding <=> ${vectorString}::vector) as similarity
                    FROM document_chunks dc
                    JOIN documents d ON dc."documentId" = d.id
                    JOIN knowledge_bases kb ON d."knowledgeBaseId" = kb.id
                    WHERE kb."companyId" = ${companyId}
                    AND d.status = 'READY'
                    ORDER BY dc.embedding <=> ${vectorString}::vector
                    LIMIT ${limit};
                `;
            }

            return results;
        } catch (error) {
            this.logger.error(`Erro na busca vetorial: ${error.message}`);
            return [];
        }
    }
}
