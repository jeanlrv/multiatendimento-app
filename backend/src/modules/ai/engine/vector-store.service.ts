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
            // TODO: Re-implementar busca por similaridade usando Json ou banco vetorial dedicado
            this.logger.warn('Busca vetorial temporariamente desabilitada (pgvector não disponível). Retornando lista vazia.');
            return [];

            /*
            const vector = await this.generateEmbedding(queryText);
            const vectorString = `[${vector.join(',')}]`;
            // ... rest of the code
            */
        } catch (error) {
            this.logger.error(`Erro na busca vetorial: ${error.message}`);
            return [];
        }
    }
}
