import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../database/prisma.service';
import { VectorStoreService } from '../../engine/vector-store.service';
import { ProviderConfigService } from '../../../settings/provider-config.service';
import { KnowledgeTextExtractorService } from './knowledge-text-extractor.service';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

@Processor('knowledge-processing', { concurrency: 1 })
export class KnowledgeProcessor extends WorkerHost {
    private readonly logger = new Logger(KnowledgeProcessor.name);

    constructor(
        private prisma: PrismaService,
        private vectorStore: VectorStoreService,
        private providerConfigService: ProviderConfigService,
        private textExtractor: KnowledgeTextExtractorService,
    ) {
        super();
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, err: Error) {
        this.logger.error({
            event: 'job_failed',
            queue: 'knowledge-processing',
            jobId: job.id,
            jobName: job.name,
            error: err.message,
            attempts: job.attemptsMade,
            data: { documentId: job.data?.documentId, companyId: job.data?.companyId },
        });
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const { documentId, companyId } = job.data;
        this.logger.log(`[Processador] Iniciando processamento do documento: ${documentId}`);

        try {
            // 1. Busca o documento e a base de conhecimento
            const document = await this.prisma.document.findUnique({
                where: { id: documentId },
                include: { knowledgeBase: true },
            });

            if (!document) throw new Error('Documento não encontrado');

            // 2. Atualiza status para PROCESSING
            await this.prisma.document.update({
                where: { id: documentId },
                data: { status: 'PROCESSING' },
            });

            // 3. Extrai o conteúdo baseado no sourceType
            this.logger.log(`[Processador] Extraindo texto do documento ${documentId} (tipo: ${document.sourceType})`);
            const extractResult = await this.textExtractor.extractTextWithMetadata(document);

            const { text, pageCount } = extractResult;

            if (!text || text.trim().length === 0) {
                throw new Error('Falha ao extrair texto do documento ou documento vazio');
            }

            this.logger.log(`[Processador] Texto extraído com sucesso: ${text.length} caracteres${pageCount ? `, ${pageCount} páginas` : ''}`);

            // 4. Chunking adaptativo — otimizado para não ofuscar o RAG Context
            const isLongDoc = text.length > 50000;
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: isLongDoc ? 1200 : 1000,
                chunkOverlap: 200,
            });
            const chunks = await splitter.splitText(text);
            this.logger.log(`[Processador] Documento ${documentId} dividido em ${chunks.length} chunks (tamanho: ${isLongDoc ? 1200 : 1000}, overlap: 200)`);

            // 5. Gera embeddings usando o provider da base de conhecimento
            let embeddingProvider = document.knowledgeBase?.embeddingProvider || 'native';
            let embeddingModel = document.knowledgeBase?.embeddingModel || 'all-MiniLM-L6-v2';

            // Busca API key da empresa para o provider de embedding configurado
            let embeddingApiKey: string | undefined;
            let embeddingBaseUrl: string | undefined;
            try {
                const providerConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
                const providerConfig = providerConfigs.get(embeddingProvider);
                embeddingApiKey = providerConfig?.apiKey ?? undefined;
                embeddingBaseUrl = providerConfig?.baseUrl ?? undefined;
            } catch (cfgErr) {
                this.logger.warn(`[Processador] Não foi possível carregar configs do provider ${embeddingProvider}: ${cfgErr.message}`);
            }

            this.logger.log(`[Processador] Documento ${documentId} — provider: ${embeddingProvider}, model: ${embeddingModel ?? 'default'}, apiKey: ${embeddingApiKey ? 'configurada' : 'não encontrada'}`);

            const BATCH_SIZE = 50;
            let processedCount = 0;
            const chunkCount = chunks.length;
            let embeddingFailed = false;
            let embeddingFailReason = '';
            // Rastreia se ativamos o fallback para native fastembed
            let usingNativeFallback = embeddingProvider === 'native';
            // Provider/modelo ativos (muda para 'native' se fallback for ativado)
            let activeProvider = embeddingProvider;
            let activeModel = embeddingModel;
            let activeApiKey = embeddingApiKey;
            let activeBaseUrl = embeddingBaseUrl;

            for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
                const batchChunks = chunks.slice(i, i + BATCH_SIZE);
                const chunkData: { id: string; documentId: string; content: string; embedding?: number[]; metadata?: any }[] = [];

                for (let j = 0; j < batchChunks.length; j++) {
                    const content = batchChunks[j];
                    let embedding: number[] | null = null;

                    if (!embeddingFailed) {
                        try {
                            embedding = await this.vectorStore.generateEmbedding(
                                content, activeProvider, activeModel, activeApiKey, activeBaseUrl
                            );
                        } catch (embErr: any) {
                            // Se o provider configurado falhou e ainda não ativamos o fallback nativo, tenta fastembed
                            if (!usingNativeFallback) {
                                this.logger.warn(
                                    `[Processador] Provider '${embeddingProvider}' falhou: ${embErr.message}. ` +
                                    `Tentando native fastembed como fallback de emergência...`
                                );
                                try {
                                    embedding = await this.vectorStore.generateEmbedding(content, 'native', 'all-MiniLM-L6-v2');
                                    usingNativeFallback = true;
                                    activeProvider = 'native';
                                    activeModel = 'all-MiniLM-L6-v2';
                                    activeApiKey = undefined;
                                    activeBaseUrl = undefined;
                                    this.logger.log(`[Processador] Native fastembed ativado como fallback. Todos os chunks restantes serão indexados com native/all-MiniLM-L6-v2 (384 dims).`);
                                } catch (natErr: any) {
                                    embeddingFailed = true;
                                    embeddingFailReason = `${embErr.message} | fallback nativo também falhou: ${natErr.message}`;
                                    this.logger.warn(
                                        `[Processador] Native fallback também falhou: ${natErr.message}. ` +
                                        `Documento será salvo SEM vetorização (apenas FTS).`
                                    );
                                }
                            } else {
                                embeddingFailed = true;
                                embeddingFailReason = embErr.message;
                                this.logger.warn(
                                    `[Processador] Falha ao gerar embedding com provider '${activeProvider}'. ` +
                                    `Documento será salvo SEM vetorização (apenas FTS). Erro: ${embErr.message}`
                                );
                            }
                        }
                    }

                    // Metadata do chunk: índice global, nome do documento e, se disponível, info de página
                    const chunkIndex = i + j;
                    const metadata: any = {
                        chunkIndex,
                        documentName: document.title || '',
                        documentId,
                    };
                    if (pageCount && pageCount > 0) {
                        // Estima página baseada no índice relativo do chunk
                        const estimatedPage = Math.ceil(((chunkIndex + 1) / chunkCount) * pageCount);
                        metadata.estimatedPage = estimatedPage;
                        metadata.totalPages = pageCount;
                    }

                    chunkData.push({
                        id: randomUUID(),
                        documentId,
                        content,
                        embedding: embedding && embedding.length > 0 ? embedding : undefined,
                        metadata,
                    });
                }

                // Insere lote atual no banco
                if (chunkData.length > 0) {
                    // Passo 1: createMany sem embedding (coluna vector não aceita via ORM)
                    await this.prisma.documentChunk.createMany({
                        data: chunkData.map(c => ({
                            id: c.id,
                            documentId: c.documentId,
                            content: c.content,
                            metadata: c.metadata ?? undefined,
                        })),
                    });

                    // Passo 2: UPDATE por ID com cast ::vector para chunks com embedding
                    const withEmbedding = chunkData.filter(c => c.embedding && c.embedding.length > 0);
                    for (const c of withEmbedding) {
                        try {
                            const vecStr = `[${c.embedding!.join(',')}]`;
                            await this.prisma.$executeRaw`
                                UPDATE document_chunks
                                SET embedding = ${vecStr}::vector
                                WHERE id = ${c.id}
                            `;
                        } catch (vecErr: any) {
                            this.logger.warn(
                                `[Processador] Falha ao armazenar embedding para chunk ${c.id} ` +
                                `(dim=${c.embedding!.length}): ${vecErr.message}. Chunk salvo sem embedding (FTS fallback).`
                            );
                        }
                    }

                    processedCount += chunkData.length;
                    this.logger.log(`Documento ${documentId} - lote inserido: ${processedCount}/${chunkCount} chunks (${withEmbedding.length} com embedding).`);
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }

            // 6. Finaliza documento
            await this.prisma.document.update({
                where: { id: documentId },
                data: {
                    status: 'READY',
                    chunkCount,
                    rawContent: text.substring(0, 100000),
                },
            });

            // 7. Se o fallback nativo foi ativado, atualiza a KB para usar 'native'
            //    garantindo que a busca use o mesmo provider/dimensão dos chunks indexados
            if (usingNativeFallback && embeddingProvider !== 'native') {
                try {
                    await this.prisma.knowledgeBase.update({
                        where: { id: document.knowledgeBaseId },
                        data: { embeddingProvider: 'native', embeddingModel: 'all-MiniLM-L6-v2' },
                    });
                    this.logger.warn(
                        `[Processador] KB ${document.knowledgeBaseId} atualizada para embeddingProvider='native' ` +
                        `(fallback ativado — provider original '${embeddingProvider}' não estava disponível). ` +
                        `Configure a chave de API do provider desejado em Configurações > IA & Modelos e reprocesse os documentos para voltar ao provider original.`
                    );
                } catch (kbErr: any) {
                    this.logger.error(`[Processador] Falha ao atualizar embeddingProvider da KB: ${kbErr.message}`);
                }
            }

            // 8. Invalida cache RAG da KB para forçar re-carregamento dos chunks na próxima query
            this.vectorStore.invalidateRagCache(document.knowledgeBaseId, companyId);

            if (embeddingFailed) {
                this.logger.warn(`Documento ${documentId} salvo como READY sem embeddings (apenas FTS). Razão: ${embeddingFailReason}`);
            } else if (usingNativeFallback && embeddingProvider !== 'native') {
                this.logger.warn(`Documento ${documentId} processado com ${chunkCount} chunks usando native fastembed (fallback). Provider original '${embeddingProvider}' indisponível.`);
            } else {
                this.logger.log(`Documento ${documentId} processado com sucesso: ${chunkCount} chunks (provider: ${activeProvider}).`);
            }
            return { success: true, chunkCount, embeddingFailed };

        } catch (error: any) {
            this.logger.error(`[Processador] Erro ao processar documento ${documentId}: ${error.message}`, error.stack);
            await this.prisma.document.update({
                where: { id: documentId },
                data: {
                    status: 'ERROR',
                    rawContent: `ERRO: ${error.message?.substring(0, 900) || 'Erro desconhecido'}\n\nVerifique o tipo do arquivo e se ele está corrompido.`
                },
            });

            // Erros permanentes (nunca se resolvem com retry) → não relança para evitar
            // loop infinito de retentativas no BullMQ. BullMQ marca o job como "completed".
            const permanentErrorPatterns = [
                'escaneado',
                'sem camada de texto',
                'senha',
                'password',
                'encrypted',
                'DRM',
                'corrompido',
                'inválid',
                'não suportado',
                'Documento não encontrado',
            ];
            const isPermanent = permanentErrorPatterns.some(p => error.message?.toLowerCase().includes(p.toLowerCase()));
            if (isPermanent) {
                this.logger.warn(`[Processador] Erro permanente — não reenfileirando: ${error.message}`);
                return { success: false, error: error.message };
            }

            throw error; // erros transitórios (rede, timeout) → BullMQ pode reintentar
        }
    }
}
