import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { join } from 'path';
import { promises as fs } from 'fs';
import { EmbeddingProviderFactory } from './embedding-provider.factory';

/**
 * VectorStoreService
 *
 * Serviço responsável por gerar e gerenciar embeddings para busca semântica.
 * Suporta múltiplos providers:
 * - 'native': Embedding local via fastembed (onnxruntime-node, sem WASM)
 * - 'openrouter': Embedding via OpenRouter (OpenAI-compat)
 * - 'openai': Embedding via API OpenAI (text-embedding-3-small, etc)
 * - 'ollama': Embedding via Ollama local (nomic-embed-text, etc)
 * - 'python-embed': Embedding via Python com sentence-transformers
 * - 'qwen': Embedding via Alibaba DashScope
 * - (qualquer outro provider registrado no EmbeddingProviderFactory)
 */

@Injectable()
export class VectorStoreService {
    private readonly logger = new Logger(VectorStoreService.name);

    // Cache RAG para invalidação
    private ragCache = new Map<string, any[]>();

    constructor(private readonly embeddingFactory: EmbeddingProviderFactory) { }

    /**
     * Invalida o cache RAG para uma base de conhecimento específica.
     */
    invalidateRagCache(knowledgeBaseId: string, companyId: string): void {
        const cacheKey = `${companyId}:${knowledgeBaseId}`;
        this.ragCache.delete(cacheKey);
        this.logger.log(`[RAG Cache] Cache invalidado para KB ${knowledgeBaseId}`);
    }

    /**
     * Busca chunks similares no banco de dados usando busca vetorial ou full-text search.
     * Implementa ranking híbrido: combina busca vetorial, full-text search e priorização por content quality.
     */
    async searchSimilarity(
        prisma: any,
        companyId: string,
        query: string,
        knowledgeBaseId: string,
        topK: number = 10,
        embeddingProvider: string = 'qwen',
        embeddingModel?: string,
        apiKey?: string,
        baseUrl?: string,
        language: string = 'portuguese',
        minScore: number = 0.10
    ): Promise<{ id: string; content: string; score: number; metadata?: any }[]> {
        const loggerPrefix = `[RAG:KB${knowledgeBaseId}]`;
        this.logger.log(`${loggerPrefix} Iniciando busca RAG para query: "${query.substring(0, 50)}..." (company=${companyId}, topK=${topK}, minScore=${minScore})`);

        try {
            // 1. Gerar embedding da query
            const queryEmbedding = await this.generateEmbedding(
                query,
                embeddingProvider,
                embeddingModel,
                apiKey,
                baseUrl
            );

            // 2. Buscar chunks no banco com metadados
            // Document não tem companyId direto — buscar IDs via Document e filtrar por documentId
            const validDocs = await prisma.document.findMany({
                where: { knowledgeBaseId, status: 'READY' },
                select: { id: true },
            });
            const validDocIds = validDocs.map((d: any) => d.id);

            if (validDocIds.length === 0) {
                this.logger.warn(`${loggerPrefix} Nenhum documento READY na KB`);
                return [];
            }

            // Limite de segurança: KBs com muitos docs podem ter milhares de chunks.
            // Carregar todos em RAM (embedding JSON = ~8-40KB/chunk) causa OOM em bases grandes.
            // Estratégia: amostragem aleatória quando exceder MAX_CHUNKS_IN_MEMORY.
            const MAX_CHUNKS_IN_MEMORY = 2000;
            const totalChunks = await prisma.documentChunk.count({
                where: { documentId: { in: validDocIds } },
            });

            let chunkQuery: any = {
                where: { documentId: { in: validDocIds } },
                select: { id: true, content: true, embedding: true, metadata: true, pageNumber: true, section: true },
            };

            // Se exceder o limite, carrega apenas os chunks mais recentes (docs recentes têm prioridade)
            if (totalChunks > MAX_CHUNKS_IN_MEMORY) {
                this.logger.warn(`${loggerPrefix} KB grande: ${totalChunks} chunks (limite ${MAX_CHUNKS_IN_MEMORY}). Carregando amostra por documento mais recente.`);
                // Pega os docIds ordenados por data de criação (mais recentes primeiro)
                const recentDocs = await prisma.document.findMany({
                    where: { id: { in: validDocIds } },
                    orderBy: { createdAt: 'desc' },
                    select: { id: true },
                    take: Math.ceil(MAX_CHUNKS_IN_MEMORY / 10), // ~10 chunks por doc em média
                });
                chunkQuery.where = { documentId: { in: recentDocs.map((d: any) => d.id) } };
                chunkQuery.take = MAX_CHUNKS_IN_MEMORY;
            }

            const chunks = await prisma.documentChunk.findMany(chunkQuery);

            if (!chunks || chunks.length === 0) {
                this.logger.warn(`${loggerPrefix} Nenhum chunk encontrado na KB`);
                return [];
            }

            this.logger.debug(`${loggerPrefix} Buscando ${chunks.length} chunks na memória...`);

            // 3. Calcular similaridade para todos os chunks
            const scored = chunks
                .filter((chunk: any) => Array.isArray(chunk.embedding) && chunk.embedding.length > 0)
                .map((chunk: any) => {
                    const vectorScore = this.cosineSimilarity(queryEmbedding, chunk.embedding);
                    return {
                        id: chunk.id,
                        content: chunk.content,
                        metadata: chunk.metadata,
                        pageNumber: chunk.pageNumber,
                        section: chunk.section,
                        vectorScore,
                        textScore: 0,
                        hybridScore: 0,
                        score: 0,
                    };
                })
                .filter(item => item.content && item.content.trim().length >= 50);

            if (scored.length === 0) {
                this.logger.warn(`${loggerPrefix} Nenhum chunk passou no filtro de comprimento`);
                return [];
            }

            // 4. Calcular FTS score (BM25-like) para ranking híbrido
            const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
            for (const item of scored) {
                const contentLower = item.content.toLowerCase();
                let matchCount = 0;
                let termScore = 0;
                for (const term of queryTerms) {
                    if (contentLower.includes(term)) {
                        matchCount++;
                        termScore += 1.0 / (matchCount + 1);
                    }
                }
                item.textScore = termScore;
            }

            // 5. Calcular Hybrid Score = 0.7 * Vector + 0.3 * Text
            for (const item of scored) {
                item.hybridScore = 0.7 * item.vectorScore + 0.3 * item.textScore;
                item.score = item.hybridScore;
            }

            // 6. Ordenar por hybrid score e aplicar minScore
            const sorted = scored
                .filter(item => item.hybridScore >= minScore)
                .sort((a: any, b: any) => b.hybridScore - a.hybridScore);

            // 7. Deduplicação: remover chunks com conteúdo muito similar
            const deduplicated: typeof sorted = [];
            for (const candidate of sorted) {
                const isDuplicate = deduplicated.some(existing => {
                    const overlap = this.jaccardSimilarity(candidate.content, existing.content);
                    return overlap > 0.7;
                });
                if (!isDuplicate) {
                    deduplicated.push(candidate);
                }
                if (deduplicated.length >= topK) break;
            }

            // 8. Logging detalhado dos top chunks
            this.logger.debug(`${loggerPrefix} Top ${Math.min(5, deduplicated.length)} chunks:`);
            for (let i = 0; i < Math.min(5, deduplicated.length); i++) {
                this.logger.debug(`${loggerPrefix}  #${i + 1}: score=${deduplicated[i].hybridScore.toFixed(3)}, text="${deduplicated[i].content.substring(0, 60)}..."`);
            }

            // 9. Fallback: busca full-text search se não houver resultados suficientes
            if (deduplicated.length < Math.ceil(topK / 2)) {
                this.logger.warn(`${loggerPrefix} Poucos resultados vetoriais (${deduplicated.length}), usando FTS fallback...`);

                try {
                    // Tabelas reais (Prisma @@map): document_chunks, documents
                    // Nota: colunas camelCase sem @map ficam com nome original no PG ("pageNumber", "documentId")
                    const ftsResults = await prisma.$queryRaw`
                        SELECT
                            dc.id,
                            dc.content,
                            dc.metadata,
                            dc."pageNumber",
                            0.5 + LEAST(0.3, (LENGTH(dc.content) - 100) / 2000.0) as score
                        FROM "document_chunks" dc
                        JOIN "documents" d ON dc."documentId" = d.id
                        WHERE d."knowledgeBaseId" = ${knowledgeBaseId}
                        AND d.status = 'READY'
                        AND LOWER(dc.content) LIKE '%' || LOWER(${query}) || '%'
                        ORDER BY LENGTH(dc.content) DESC
                        LIMIT ${topK * 2}
                    `;

                    this.logger.log(`${loggerPrefix} ${ftsResults?.length || 0} resultados via FTS`);
                    const ftsChunks = (ftsResults || []).map((result: any) => {
                        const sqlScore = parseFloat(result.score) || 0.5;
                        return {
                            id: result.id,
                            content: result.content,
                            metadata: result.metadata,
                            pageNumber: result.pageNumber,
                            section: null,
                            vectorScore: 0.0,
                            textScore: sqlScore,
                            hybridScore: sqlScore,
                            score: sqlScore,
                        };
                    });

                    // Mesclar FTS com resultados vetoriais e re-deduplicar
                    const merged = [...deduplicated, ...ftsChunks];
                    const final: typeof deduplicated = [];
                    for (const candidate of merged) {
                        const isDuplicate = final.some(existing => {
                            const overlap = this.jaccardSimilarity(candidate.content, existing.content);
                            return overlap > 0.7;
                        });
                        if (!isDuplicate) {
                            final.push(candidate);
                        }
                        if (final.length >= topK) break;
                    }

                    this.logger.log(`${loggerPrefix} resultado final: ${final.length} chunks (vetorial: ${deduplicated.length}, FTS: ${ftsChunks.length})`);
                    return final;
                } catch (ftsError) {
                    // FTS falhou — retorna os resultados vetoriais que já temos (não descarta)
                    this.logger.warn(`${loggerPrefix} FTS fallback falhou (${ftsError.message}), retornando ${deduplicated.length} chunks vetoriais`);
                    return deduplicated;
                }
            }

            this.logger.log(`${loggerPrefix} ${deduplicated.length} chunks retornados`);
            return deduplicated;
        } catch (error) {
            this.logger.error(`${loggerPrefix} Erro na busca por similaridade: ${error.message}`, error.stack);
            return [];
        }
    }

    /**
     * Gera embedding para um texto usando o provider especificado.
     */
    async generateEmbedding(
        text: string,
        provider: string = 'qwen',
        model?: string,
        apiKey?: string,
        baseUrl?: string
    ): Promise<number[]> {
        const MAX_RETRIES = 3;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const embeddings = await this.embedQueryWithProvider(text, provider, model, apiKey, baseUrl);
                if (embeddings && embeddings.length > 0) {
                    return embeddings;
                }
                throw new Error('Embedding vazio ou inválido');
            } catch (err: any) {
                lastError = err;
                this.logger.warn(
                    `Tentativa ${attempt}/${MAX_RETRIES} falhou com provider '${provider}': ${err.message}`
                );

                if (attempt < MAX_RETRIES) {
                    const delay = Math.pow(2, attempt - 1) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // Fallback: tentar OpenAI se provider nativo falhar
        if (provider !== 'openai' && provider !== 'qwen') {
            this.logger.warn(`Provider '${provider}' falhou após ${MAX_RETRIES} tentativas. Tentando fallback para OpenAI...`);
            const openAiKey = process.env.OPENAI_API_KEY;

            if (openAiKey) {
                try {
                    const embeddings = await this.embedQueryWithProvider(text, 'openai', 'text-embedding-3-small', openAiKey, undefined);
                    if (embeddings && embeddings.length > 0) {
                        this.logger.log('Fallback para OpenAI bem-sucedido');
                        return embeddings;
                    }
                } catch (fallbackErr: any) {
                    this.logger.error(`Fallback para OpenAI também falhou: ${fallbackErr.message}`);
                }
            } else {
                this.logger.warn('OpenAI API key não configurada, pulando fallback');
            }
        }

        // Fallback: tentar Qwen se provider nativo falhar e tiver chave
        if (provider !== 'qwen') {
            this.logger.warn(`Provider '${provider}' falhou após ${MAX_RETRIES} tentativas. Tentando fallback para Qwen (Alibaba)...`);
            const qwenKey = process.env.QWEN_API_KEY;

            if (qwenKey) {
                try {
                    const embeddings = await this.embedQueryWithProvider(text, 'qwen', 'text-embedding-v2', qwenKey, undefined);
                    if (embeddings && embeddings.length > 0) {
                        this.logger.log('Fallback para Qwen (Alibaba) bem-sucedido');
                        return embeddings;
                    }
                } catch (fallbackErr: any) {
                    this.logger.error(`Fallback para Qwen também falhou: ${fallbackErr.message}`);
                }
            } else {
                this.logger.warn('QWEN_API_KEY não configurada, pulando fallback');
            }
        }

        throw new Error(
            `Falha ao gerar embedding: ${lastError?.message || 'Erro desconhecido'}. ` +
            `Provider: ${provider}, Model: ${model || 'default'}`
        );
    }

    /**
     * Gera embeddings para múltiplos textos em lote.
     */
    async generateEmbeddingsBatch(
        texts: string[],
        provider: string = 'qwen',
        model?: string,
        apiKey?: string,
        baseUrl?: string
    ): Promise<number[][]> {
        const BATCH_SIZE = 50;
        const allEmbeddings: number[][] = [];

        for (let i = 0; i < texts.length; i += BATCH_SIZE) {
            const batch = texts.slice(i, i + BATCH_SIZE);
            const batchEmbeddings = await this.generateEmbeddingBatchInternal(batch, provider, model, apiKey, baseUrl);
            allEmbeddings.push(...batchEmbeddings);

            if (i + BATCH_SIZE < texts.length) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        return allEmbeddings;
    }

    /**
     * Gera embedding para um único texto usando o provider especificado.
     */
    private async embedQueryWithProvider(
        text: string,
        provider: string,
        model?: string,
        apiKey?: string,
        baseUrl?: string
    ): Promise<number[]> {
        if (provider === 'openai') {
            return this.embedWithOpenAI(text, model || 'text-embedding-3-small', apiKey);
        }

        if (provider === 'ollama') {
            return this.embedWithOllama(text, model || 'nomic-embed-text', baseUrl);
        }

        if (provider === 'python-embed') {
            return this.embedWithPython(text, model || 'all-MiniLM-L6-v2');
        }

        if (provider === 'qwen') {
            return this.embedWithQwen(text, model || 'text-embedding-v2', apiKey);
        }

        // Todos os demais providers (native, openrouter, gemini, cohere, azure, voyage…)
        // são delegados ao EmbeddingProviderFactory (fastembed / OpenAI-compat)
        const embedder = this.embeddingFactory.createEmbeddings(provider, model, apiKey, baseUrl);
        return embedder.embedQuery(text);
    }

    /**
     * Gera embeddings para lote de textos usando o provider especificado.
     */
    private async generateEmbeddingBatchInternal(
        texts: string[],
        provider: string,
        model?: string,
        apiKey?: string,
        baseUrl?: string
    ): Promise<number[][]> {
        if (provider === 'openai') {
            return this.embedBatchWithOpenAI(texts, model || 'text-embedding-3-small', apiKey);
        }

        if (provider === 'ollama') {
            return this.embedBatchWithOllama(texts, model || 'nomic-embed-text', baseUrl);
        }

        if (provider === 'python-embed') {
            return this.embedBatchWithPython(texts, model || 'all-MiniLM-L6-v2');
        }

        if (provider === 'qwen') {
            return this.embedBatchWithQwen(texts, model || 'text-embedding-v2', apiKey);
        }

        // Todos os demais providers delegados ao EmbeddingProviderFactory
        const embedder = this.embeddingFactory.createEmbeddings(provider, model, apiKey, baseUrl);
        return embedder.embedDocuments(texts);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Provider: OpenAI
    // ──────────────────────────────────────────────────────────────────────────

    private async embedWithOpenAI(text: string, model: string, apiKey?: string): Promise<number[]> {
        const key = apiKey || process.env.OPENAI_API_KEY;
        if (!key) throw new Error('OPENAI_API_KEY não configurada para embedding OpenAI');

        const { OpenAI } = require('openai');
        const openai = new OpenAI({ apiKey: key });

        const response = await openai.embeddings.create({
            model,
            input: text,
            encoding_format: 'float',
        });

        return response.data[0].embedding;
    }

    private async embedBatchWithOpenAI(texts: string[], model: string, apiKey?: string): Promise<number[][]> {
        const key = apiKey || process.env.OPENAI_API_KEY;
        if (!key) throw new Error('OPENAI_API_KEY não configurada para embedding OpenAI');

        const { OpenAI } = require('openai');
        const openai = new OpenAI({ apiKey: key });

        const response = await openai.embeddings.create({
            model,
            input: texts,
            encoding_format: 'float',
        });

        return response.data
            .sort((a: any, b: any) => a.index - b.index)
            .map((item: any) => item.embedding);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Provider: Ollama (local)
    // ──────────────────────────────────────────────────────────────────────────

    private async embedWithOllama(text: string, model: string, baseUrl?: string): Promise<number[]> {
        const host = baseUrl || process.env.OLLAMA_HOST || 'http://localhost:11434';

        const axios = require('axios');
        const response = await axios.post(`${host}/api/embeddings`, {
            model,
            prompt: text,
        }, { timeout: 60000 });

        return response.data.embedding || [];
    }

    private async embedBatchWithOllama(texts: string[], model: string, baseUrl?: string): Promise<number[][]> {
        const embeddings: number[][] = [];
        for (const text of texts) {
            const emb = await this.embedWithOllama(text, model, baseUrl);
            embeddings.push(emb);
        }
        return embeddings;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Provider: Python (sentence-transformers via subprocesso)
    // ──────────────────────────────────────────────────────────────────────────

    private async embedWithPython(text: string, model: string): Promise<number[]> {
        const pythonPath = process.env.PYTHON_PATH || 'python3';
        const scriptPath = join(process.cwd(), 'backend', 'embedding.py');

        return new Promise((resolve, reject) => {
            fs.access(scriptPath, fs.constants.R_OK).then(() => {
                execFile(pythonPath, [scriptPath, text], {
                    timeout: 60000,
                    maxBuffer: 1024 * 1024 * 10,
                }, (error, stdout, stderr) => {
                    if (error) {
                        this.logger.warn(`[Python Embed] Erro ao executar embedding: ${error.message}`);
                        if (stdout) this.logger.debug(`[Python Embed] stdout: ${stdout}`);
                        if (stderr) this.logger.debug(`[Python Embed] stderr: ${stderr}`);
                        return reject(new Error(`Falha ao gerar embedding via Python: ${error.message}`));
                    }

                    try {
                        const result = JSON.parse(stdout);
                        if (result.success && result.embedding) {
                            resolve(result.embedding);
                        } else {
                            reject(new Error(`Python embedding falhou: ${result.error || 'Resposta inválida'}`));
                        }
                    } catch (parseError) {
                        this.logger.error(`[Python Embed] Erro ao parsear resposta JSON: ${parseError.message}`);
                        reject(new Error(`Falha ao parsear resposta do embedding Python: ${parseError.message}`));
                    }
                });
            }).catch(() => {
                this.logger.warn(`[Python Embed] Script não encontrado: ${scriptPath}. Tentando ONNX.`);
                reject(new Error(`Python embedding script não encontrado. Verifique se Python e sentence-transformers estão instalados.`));
            });
        });
    }

    private async embedBatchWithPython(texts: string[], model: string): Promise<number[][]> {
        const BATCH_SIZE = 10;
        const allEmbeddings: number[][] = [];

        for (let i = 0; i < texts.length; i += BATCH_SIZE) {
            const batch = texts.slice(i, i + BATCH_SIZE);
            const batchEmbeddings = await Promise.all(
                batch.map(text => this.embedWithPython(text, model))
            );
            allEmbeddings.push(...batchEmbeddings);

            if (i + BATCH_SIZE < texts.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return allEmbeddings;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Provider: Qwen (Alibaba)
    // ──────────────────────────────────────────────────────────────────────────

    private async embedWithQwen(text: string, model: string, apiKey?: string): Promise<number[]> {
        const key = apiKey || process.env.QWEN_API_KEY;
        if (!key) throw new Error('QWEN_API_KEY não configurada para embedding Qwen');

        const { OpenAI } = require('openai');
        const qwen = new OpenAI({ apiKey: key, baseURL: 'https://coding-intl.dashscope.aliyuncs.com/v1' });

        const response = await qwen.embeddings.create({
            model,
            input: text,
            encoding_format: 'float',
        });

        return response.data[0].embedding;
    }

    private async embedBatchWithQwen(texts: string[], model: string, apiKey?: string): Promise<number[][]> {
        const key = apiKey || process.env.QWEN_API_KEY;
        if (!key) throw new Error('QWEN_API_KEY não configurada para embedding Qwen');

        const { OpenAI } = require('openai');
        const qwen = new OpenAI({ apiKey: key, baseURL: 'https://coding-intl.dashscope.aliyuncs.com/v1' });

        const response = await qwen.embeddings.create({
            model,
            input: texts,
            encoding_format: 'float',
        });

        return response.data
            .sort((a: any, b: any) => a.index - b.index)
            .map((item: any) => item.embedding);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Utilitários
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Calcula similaridade de cosseno entre dois vetores.
     */
    cosineSimilarity(vecA: number[], vecB: number[]): number {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Calcula similaridade de Jaccard entre dois textos (por tokens).
     * Usada para deduplicação de chunks com conteúdo repetido.
     */
    private jaccardSimilarity(textA: string, textB: string): number {
        const tokenize = (t: string) => new Set(t.toLowerCase().split(/\W+/).filter(w => w.length > 2));
        const setA = tokenize(textA);
        const setB = tokenize(textB);
        if (setA.size === 0 && setB.size === 0) return 1;
        if (setA.size === 0 || setB.size === 0) return 0;
        let intersection = 0;
        for (const token of setA) {
            if (setB.has(token)) intersection++;
        }
        const union = setA.size + setB.size - intersection;
        return intersection / union;
    }

    /**
     * Encontra os chunks mais similares a uma query (versão em memória).
     */
    findMostSimilar(
        queryEmbedding: number[],
        chunks: { id: string; embedding: number[]; content: string }[],
        topK: number = 5
    ): { id: string; content: string; score: number }[] {
        const scored = chunks.map(chunk => ({
            id: chunk.id,
            content: chunk.content,
            score: this.cosineSimilarity(queryEmbedding, chunk.embedding),
        }));

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, topK);
    }

    /**
     * Limpa recursos ao fechar a aplicação.
     */
    onModuleDestroy() {
        // EmbeddingProviderFactory (fastembed) gerencia seus próprios recursos via GC
    }
}