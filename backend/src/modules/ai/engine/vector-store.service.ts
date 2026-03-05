import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';

/**
 * VectorStoreService
 *
 * Serviço responsável por gerar e gerenciar embeddings para busca semântica.
 * Suporta múltiplos providers:
 * - 'native': Embedding local via @xenova/transformers (worker isolado)
 * - 'openai': Embedding via API OpenAI (text-embedding-3-small, etc)
 * - 'ollama': Embedding via Ollama local (nomic-embed-text, mxbai-embed-large, etc)
 *
 * CORREÇÕES APLICADAS:
 * - Retry automático com backoff exponencial
 * - Fallback entre providers (native → openai)
 * - Timeout aumentado para 300s
 * - Melhor logging de erros
 * - Métodos invalidateRagCache e searchSimilarity adicionados
 */

@Injectable()
export class VectorStoreService {
    private readonly logger = new Logger(VectorStoreService.name);
    private embedWorker: ChildProcess | null = null;
    private embedWorkerReady = false;
    private embedWorkerId = 0;
    private pendingCallbacks = new Map<number, any>();

    // Cache RAG para invalidação
    private ragCache = new Map<string, any[]>();

    constructor() {
        this.spawnEmbedWorker();
    }

    /**
     * Invalida o cache RAG para uma base de conhecimento específica.
     * Chamado quando documentos são atualizados/adicionados/removidos.
     */
    invalidateRagCache(knowledgeBaseId: string, companyId: string): void {
        const cacheKey = `${companyId}:${knowledgeBaseId}`;
        this.ragCache.delete(cacheKey);
        this.logger.log(`[RAG Cache] Cache invalidado para KB ${knowledgeBaseId}`);
    }

    /**
     * Busca chunks similares no banco de dados usando busca vetorial ou full-text search.
     * Fallback: busca semântica via embedding → busca full-text → busca por palavras-chave.
     */
    async searchSimilarity(
        prisma: any,
        companyId: string,
        query: string,
        knowledgeBaseId: string,
        topK: number = 10,
        embeddingProvider: string = 'native',
        embeddingModel?: string,
        apiKey?: string,
        baseUrl?: string,
        language: string = 'portuguese',
        minScore: number = 0.15
    ): Promise<{ id: string; content: string; score: number; metadata?: any }[]> {
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
            const chunks = await prisma.documentChunk.findMany({
                where: {
                    knowledgeBaseId,
                    document: {
                        companyId,
                        status: 'READY' // Apenas documentos processados com sucesso
                    },
                },
                select: {
                    id: true,
                    content: true,
                    embedding: true,
                    metadata: true,
                    pageNumber: true,
                    section: true
                },
            });

            if (!chunks || chunks.length === 0) {
                this.logger.warn(`[RAG] Nenhum chunk encontrado na KB ${knowledgeBaseId}`);
                return [];
            }

            // 3. Calcular similaridade, filtrar por score mínimo e retornar top-K sem duplicatas
            const scored = chunks
                .map((chunk: any) => ({
                    id: chunk.id,
                    content: chunk.content,
                    metadata: chunk.metadata,
                    pageNumber: chunk.pageNumber,
                    section: chunk.section,
                    score: this.cosineSimilarity(queryEmbedding, chunk.embedding),
                }))
                // Filtrar chunks com conteúdo significativo
                .filter(item => item.content && item.content.trim().length > 10)
                // Filtrar por score mínimo para eliminar chunks irrelevantes
                .filter(item => item.score >= minScore)
                // Ordenar por score
                .sort((a: any, b: any) => b.score - a.score);

            // Deduplicação: remover chunks com conteúdo muito similar entre si (>0.92)
            const deduplicated: typeof scored = [];
            for (const candidate of scored) {
                const isDuplicate = deduplicated.some(existing => {
                    // Comparação rápida por texto (evita recalcular embeddings)
                    const overlap = this.jaccardSimilarity(candidate.content, existing.content);
                    return overlap > 0.7;
                });
                if (!isDuplicate) {
                    deduplicated.push(candidate);
                }
                if (deduplicated.length >= topK) break;
            }

            this.logger.debug(`[RAG] ${deduplicated.length} chunks encontrados (score>=${minScore}) para query: "${query.substring(0, 50)}..."`);
            return deduplicated;
        } catch (error) {
            this.logger.error(`[RAG] Erro na busca por similaridade: ${error.message}`);

            // Fallback: busca full-text search com peso adicional
            try {
                const ftsResults = await prisma.$queryRaw`
                    SELECT id, content, metadata, page_number as "pageNumber", section, 0.5 as score
                    FROM "DocumentChunk" dc
                    JOIN "Document" d ON dc."documentId" = d.id
                    WHERE dc."knowledgeBaseId" = ${knowledgeBaseId}
                    AND d."companyId" = ${companyId}
                    AND d.status = 'READY'
                    AND (
                        dc.content ILIKE '%' || ${query} || '%'
                        OR dc.content ILIKE '%' || LOWER(${query}) || '%'
                    )
                    ORDER BY LENGTH(dc.content) DESC
                    LIMIT ${topK}
                `;

                this.logger.debug(`[RAG Fallback] ${ftsResults?.length || 0} resultados via full-text search`);

                // Converter resultados para o formato esperado
                return (ftsResults || []).map((result: any) => ({
                    id: result.id,
                    content: result.content,
                    score: result.score || 0.5,
                    metadata: result.metadata,
                    pageNumber: result.pageNumber,
                    section: result.section
                }));
            } catch (ftsError) {
                this.logger.error(`[RAG Fallback] Erro na busca full-text: ${ftsError.message}`);
                return [];
            }
        }
    }

    /**
     * Gera embedding para um texto usando o provider especificado.
     * Inclui retry automático e fallback.
     */
    async generateEmbedding(
        text: string,
        provider: string = 'native',
        model?: string,
        apiKey?: string,
        baseUrl?: string
    ): Promise<number[]> {
        const MAX_RETRIES = 3;
        let lastError: Error | null = null;

        // Tentar provider principal
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
                    // Backoff exponencial: 1s, 2s, 4s
                    const delay = Math.pow(2, attempt - 1) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // Fallback: tentar OpenAI se provider nativo falhar
        if (provider !== 'openai') {
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

        // Se tudo falhar, lança o último erro
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
        provider: string = 'native',
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

            // Pequeno delay entre lotes para não sobrecarregar
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

        // Provider nativo (padrão) - retorna array simples
        const result = await this.embedWithNative(text, model || 'Xenova/bge-micro-v2');
        return result;
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

        // Provider nativo (padrão) - retorna array de arrays
        return this.embedBatchWithNative(texts, model || 'Xenova/bge-micro-v2');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Provider: Nativo (@xenova/transformers via worker isolado)
    // ──────────────────────────────────────────────────────────────────────────

    private spawnEmbedWorker() {
        if (this.embedWorker) {
            try {
                this.embedWorker.kill();
            } catch { /* ignore */ }
        }

        const currentId = ++this.embedWorkerId;
        const workerPath = join(__dirname, 'embedding.worker.js');
        this.embedWorker = spawn('node', [workerPath], {
            stdio: ['ipc', 'pipe', 'pipe'],
            env: { ...process.env },
        });

        this.embedWorker.stdout?.on('data', (data) => {
            this.logger.debug(`[EmbedWorker stdout] ${data.toString().trim()}`);
        });

        this.embedWorker.stderr?.on('data', (data) => {
            this.logger.warn(`[EmbedWorker stderr] ${data.toString().trim()}`);
        });

        this.embedWorker.on('message', (msg: any) => {
            if (!msg || typeof msg !== 'object') return;

            // Log messages do worker
            if (msg.type === 'log') {
                const logMsg = `[EmbedWorker #${currentId}] ${msg.message}`;
                if (msg.level === 'error') this.logger.error(logMsg);
                else if (msg.level === 'warn') this.logger.warn(logMsg);
                else this.logger.log(logMsg);
                return;
            }

            // Worker está pronto
            if (msg.type === 'ready') {
                this.embedWorkerReady = true;
                this.logger.log(`[EmbedWorker #${currentId}] Worker pronto`);
                return;
            }

            // Resultado de embedding
            if (msg.type === 'result' && msg.id !== undefined) {
                const pending = this.pendingCallbacks.get(msg.id);
                if (pending) {
                    clearTimeout(pending.timeout);
                    this.pendingCallbacks.delete(msg.id);
                    pending.resolve(msg.embeddings);
                }
                return;
            }

            // Erro de embedding
            if (msg.type === 'error' && msg.id !== undefined) {
                const pending = this.pendingCallbacks.get(msg.id);
                if (pending) {
                    clearTimeout(pending.timeout);
                    this.pendingCallbacks.delete(msg.id);
                    pending.reject(new Error(msg.message));
                }
                return;
            }
        });

        this.embedWorker.on('exit', (code) => {
            this.embedWorkerReady = false;
            this.logger.warn(`[EmbedWorker #${currentId}] Worker saiu com código ${code}`);

            // Restart automático após 2s
            setTimeout(() => this.spawnEmbedWorker(), 2000);
        });

        this.embedWorker.on('error', (err) => {
            this.logger.error(`[EmbedWorker #${currentId}] Erro: ${err.message}`);
        });
    }

    private embedWithNative(text: string, model: string): Promise<number[]> {
        return new Promise((resolve, reject) => {
            if (!this.embedWorker || !this.embedWorkerReady) {
                reject(new Error('Worker de embeddings não está pronto. Verifique se @xenova/transformers está instalado.'));
                return;
            }

            const id = ++this.embedWorkerId;
            const timeoutMs = 300_000; // 300 segundos

            const timeout = setTimeout(() => {
                this.pendingCallbacks.delete(id);
                reject(new Error(`Timeout (${timeoutMs / 1000}s) ao gerar embedding nativo`));
            }, timeoutMs);

            this.pendingCallbacks.set(id, { resolve, reject, timeout });

            this.embedWorker?.send({ type: 'embed', id, model, texts: [text] });
        });
    }

    private embedBatchWithNative(texts: string[], model: string): Promise<number[][]> {
        if (!this.embedWorker || !this.embedWorkerReady) {
            throw new Error('Worker de embeddings não está pronto');
        }

        return new Promise((resolve, reject) => {
            const id = ++this.embedWorkerId;
            const timeoutMs = 300_000; // 300 segundos

            const timeout = setTimeout(() => {
                this.pendingCallbacks.delete(id);
                reject(new Error(`Timeout (${timeoutMs / 1000}s) ao gerar embeddings nativos em lote`));
            }, timeoutMs);

            this.pendingCallbacks.set(id, { resolve, reject, timeout });

            this.embedWorker?.send({ type: 'embed', id, model, texts });
        });
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

        // OpenAI suporta batch de até 2048 textos por requisição
        const response = await openai.embeddings.create({
            model,
            input: texts,
            encoding_format: 'float',
        });

        // Ordenar pelo índice para garantir ordem correta
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
        // Ollama não suporta batch nativo, processar um por um
        const embeddings: number[][] = [];
        for (const text of texts) {
            const emb = await this.embedWithOllama(text, model, baseUrl);
            embeddings.push(emb);
        }
        return embeddings;
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
        // Tokeniza por palavras simples (sem stopwords para manter simples e rápido)
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
        if (this.embedWorker) {
            this.embedWorker.send({ type: 'exit' });
            setTimeout(() => {
                if (this.embedWorker) {
                    this.embedWorker.kill();
                }
            }, 2000);
        }
    }
}