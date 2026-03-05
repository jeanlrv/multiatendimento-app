import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Embeddings } from '@langchain/core/embeddings';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChildProcess } from 'child_process';

export interface EmbeddingModelConfig {
    id: string;
    name: string;
    dimensions: number;
}

export interface EmbeddingProviderConfig {
    id: string;
    name: string;
    envKey: string;
    baseURL?: string;
    models: EmbeddingModelConfig[];
}

export const EMBEDDING_PROVIDERS: EmbeddingProviderConfig[] = [
    {
        id: 'openai',
        name: 'OpenAI',
        envKey: 'OPENAI_API_KEY',
        models: [
            { id: 'text-embedding-3-small', name: 'text-embedding-3-small (Econômico)', dimensions: 1536 },
            { id: 'text-embedding-3-large', name: 'text-embedding-3-large (Alta qualidade)', dimensions: 3072 },
            { id: 'text-embedding-ada-002', name: 'text-embedding-ada-002 (Legado)', dimensions: 1536 },
        ],
    },
    {
        id: 'native',
        name: 'Nativo (built-in CPU)',
        envKey: '',
        models: [
            { id: 'Xenova/all-MiniLM-L6-v2', name: 'all-MiniLM-L6-v2 (Mais leve, estável)', dimensions: 384 },
            { id: 'Xenova/bge-micro-v2', name: 'bge-micro-v2 (Rápido, mas pode crashar)', dimensions: 384 },
        ],
    },
    {
        id: 'ollama',
        name: 'Ollama (Local)',
        envKey: 'OLLAMA_BASE_URL',
        baseURL: 'http://localhost:11434/v1',
        models: [
            { id: 'nomic-embed-text', name: 'nomic-embed-text (Recomendado)', dimensions: 768 },
            { id: 'mxbai-embed-large', name: 'mxbai-embed-large (Alta qualidade)', dimensions: 1024 },
            { id: 'all-minilm', name: 'all-MiniLM (Leve)', dimensions: 384 },
        ],
    },
    {
        id: 'gemini',
        name: 'Google Gemini',
        envKey: 'GEMINI_API_KEY',
        models: [
            { id: 'text-embedding-004', name: 'text-embedding-004', dimensions: 768 },
            { id: 'embedding-001', name: 'embedding-001 (Legado)', dimensions: 768 },
        ],
    },
    {
        id: 'cohere',
        name: 'Cohere',
        envKey: 'COHERE_API_KEY',
        models: [
            { id: 'embed-multilingual-v3.0', name: 'embed-multilingual-v3.0 (PT-BR)', dimensions: 1024 },
            { id: 'embed-english-v3.0', name: 'embed-english-v3.0', dimensions: 1024 },
            { id: 'embed-multilingual-light-v3.0', name: 'embed-multilingual-light-v3.0 (Leve)', dimensions: 384 },
        ],
    },
    {
        id: 'azure',
        name: 'Azure OpenAI',
        envKey: 'AZURE_OPENAI_API_KEY',
        models: [
            { id: 'text-embedding-ada-002', name: 'text-embedding-ada-002', dimensions: 1536 },
            { id: 'text-embedding-3-small', name: 'text-embedding-3-small', dimensions: 1536 },
            { id: 'text-embedding-3-large', name: 'text-embedding-3-large', dimensions: 3072 },
        ],
    },
    {
        id: 'voyage',
        name: 'Voyage AI',
        envKey: 'VOYAGE_API_KEY',
        baseURL: 'https://api.voyageai.com/v1',
        models: [
            { id: 'voyage-3', name: 'voyage-3 (Melhor custo-benefício)', dimensions: 1024 },
            { id: 'voyage-3-large', name: 'voyage-3-large (Alta qualidade)', dimensions: 1024 },
            { id: 'voyage-3-lite', name: 'voyage-3-lite (Econômico)', dimensions: 512 },
            { id: 'voyage-multilingual-2', name: 'voyage-multilingual-2 (PT-BR)', dimensions: 1024 },
        ],
    },
    {
        id: 'anythingllm',
        name: 'AnythingLLM RAG',
        envKey: 'ANYTHINGLLM_API_KEY',
        baseURL: 'http://localhost:3001/api/v1',
        models: [
            { id: 'anythingllm:embedding', name: 'AnythingLLM Native Embedder', dimensions: 768 },
        ],
    },
    {
        id: 'qwen',
        name: 'Qwen (Alibaba)',
        envKey: 'QWEN_API_KEY',
        models: [
            { id: 'text-embedding-v2', name: 'text-embedding-v2 (Recomendado)', dimensions: 1024 },
            { id: 'text-embedding-v1', name: 'text-embedding-v1 (Legado)', dimensions: 1024 },
        ],
    },
];


@Injectable()
export class EmbeddingProviderFactory implements OnModuleInit {
    private readonly logger = new Logger(EmbeddingProviderFactory.name);

    constructor(private configService: ConfigService) { }

    /**
     * O warm-up automático foi removido para garantir estabilidade no Railway.
     * O modelo será carregado sob demanda no primeiro uso pelo método createNativeEmbeddings.
     */
    async onModuleInit() {
        this.logger.log('[AI] EmbeddingProviderFactory inicializado (Warm-up automático desativado para estabilidade).');
    }

    /**
     * Cria instância do provedor de embedding correto.
     * @param providerId ID do provider (openai, ollama, gemini, cohere, azure, voyage)
     * @param modelId ID do modelo de embedding
     * @param apiKeyOverride API key da empresa (vinda do banco), sobrepõe env var global
     * @param baseUrlOverride Base URL override (para Ollama/Azure)
     */
    createEmbeddings(
        providerId: string = 'openai',
        modelId?: string,
        apiKeyOverride?: string,
        baseUrlOverride?: string,
    ): Embeddings {
        const provider = EMBEDDING_PROVIDERS.find(p => p.id === providerId);
        if (!provider) {
            this.logger.warn(`Provider de embedding desconhecido: ${providerId}. Usando OpenAI.`);
            return this.createOpenAIEmbeddings('text-embedding-3-small', apiKeyOverride);
        }

        const model = modelId || provider.models[0].id;
        this.logger.log(`Criando embedding: ${providerId}/${model}`);

        switch (providerId) {
            case 'openai':
                return this.createOpenAIEmbeddings(model, apiKeyOverride);
            case 'ollama':
                return this.createOllamaEmbeddings(model, baseUrlOverride);
            case 'gemini':
                return this.createGeminiEmbeddings(model, apiKeyOverride);
            case 'cohere':
                return this.createCohereEmbeddings(model, apiKeyOverride);
            case 'azure':
                return this.createAzureEmbeddings(model, apiKeyOverride, baseUrlOverride);
            case 'voyage':
                return this.createVoyageEmbeddings(model, apiKeyOverride);
            case 'native':
                return this.createNativeEmbeddings(model);
            case 'anythingllm':
                return this.createAnythingLLMEmbeddings(model, apiKeyOverride, baseUrlOverride);
            case 'qwen':
                return this.createQwenEmbeddings(model, apiKeyOverride);
            default:
                this.logger.warn(`Provider de embedding '${providerId}' sem implementação específica. Tentando como OpenAI-compat.`);
                return this.createOpenAIEmbeddings(model, apiKeyOverride);
        }
    }

    private createOpenAIEmbeddings(model: string, apiKeyOverride?: string): Embeddings {
        const apiKey = apiKeyOverride || this.configService.get<string>('OPENAI_API_KEY');
        if (!apiKey) throw new Error('OPENAI_API_KEY não configurada. Configure em Configurações > Integrações.');
        return new OpenAIEmbeddings({ openAIApiKey: apiKey, modelName: model });
    }

    private createOllamaEmbeddings(model: string, baseUrlOverride?: string): Embeddings {
        const baseURL = baseUrlOverride || this.configService.get<string>('OLLAMA_BASE_URL') || 'http://localhost:11434/v1';
        // Ollama expõe endpoint OpenAI-compat para embeddings
        return new OpenAIEmbeddings({
            openAIApiKey: 'ollama',
            modelName: model,
            configuration: { baseURL },
        });
    }

    private createGeminiEmbeddings(model: string, apiKeyOverride?: string): Embeddings {
        const apiKey = apiKeyOverride || this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) throw new Error('GEMINI_API_KEY não configurada. Configure em Configurações > Integrações.');
        const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
        return new GoogleGenerativeAIEmbeddings({ apiKey, model });
    }

    private createCohereEmbeddings(model: string, apiKeyOverride?: string): Embeddings {
        const apiKey = apiKeyOverride || this.configService.get<string>('COHERE_API_KEY');
        if (!apiKey) throw new Error('COHERE_API_KEY não configurada. Configure em Configurações > Integrações.');
        const { CohereEmbeddings } = require('@langchain/cohere');
        return new CohereEmbeddings({ apiKey, model });
    }

    private createAzureEmbeddings(model: string, apiKeyOverride?: string, endpointOverride?: string): Embeddings {
        const apiKey = apiKeyOverride || this.configService.get<string>('AZURE_OPENAI_API_KEY');
        const endpoint = endpointOverride || this.configService.get<string>('AZURE_OPENAI_ENDPOINT');
        if (!apiKey || !endpoint) throw new Error('AZURE_OPENAI_API_KEY ou AZURE_OPENAI_ENDPOINT não configurados. Configure em Configurações > Integrações.');
        const { AzureOpenAIEmbeddings } = require('@langchain/openai');
        return new AzureOpenAIEmbeddings({
            azureOpenAIApiKey: apiKey,
            azureOpenAIApiInstanceName: endpoint.replace('https://', '').replace('.openai.azure.com/', ''),
            azureOpenAIApiDeploymentName: model,
            azureOpenAIApiVersion: '2024-02-01',
        });
    }

    private createVoyageEmbeddings(model: string, apiKeyOverride?: string): Embeddings {
        const apiKey = apiKeyOverride || this.configService.get<string>('VOYAGE_API_KEY');
        if (!apiKey) throw new Error('VOYAGE_API_KEY não configurada. Configure em Configurações > Integrações.');
        // Voyage AI é compatível com a API de embeddings da OpenAI
        return new OpenAIEmbeddings({
            openAIApiKey: apiKey,
            modelName: model,
            configuration: { baseURL: 'https://api.voyageai.com/v1' },
        });
    }

    private createAnythingLLMEmbeddings(model: string, apiKeyOverride?: string, baseUrlOverride?: string): Embeddings {
        const apiKey = apiKeyOverride || this.configService.get<string>('ANYTHINGLLM_API_KEY');
        // Aceita tanto ANYTHINGLLM_BASE_URL quanto ANYTHINGLLM_API_URL (alias usado no docker-compose)
        const rawUrl = baseUrlOverride
            || this.configService.get<string>('ANYTHINGLLM_BASE_URL')
            || this.configService.get<string>('ANYTHINGLLM_API_URL')
            || 'http://localhost:3001/api/v1';
        const baseURL = rawUrl.replace(/\/api\/v1\/?$/, '') + '/api/v1';
        if (!apiKey) throw new Error('ANYTHINGLLM_API_KEY não configurada. Configure em Configurações > IA & Modelos.');
        // AnythingLLM expõe endpoint OpenAI-compat para embeddings
        return new OpenAIEmbeddings({
            openAIApiKey: apiKey,
            modelName: model,
            configuration: { baseURL: `${baseURL}/openai` },
        });
    }

    private createQwenEmbeddings(model: string, apiKeyOverride?: string): Embeddings {
        const apiKey = apiKeyOverride || this.configService.get<string>('QWEN_API_KEY');
        if (!apiKey) throw new Error('QWEN_API_KEY não configurada. Configure em Configurações > Integrações.');
        // Qwen usa endpoint compatível com OpenAI, mas com URL específica
        return new OpenAIEmbeddings({
            openAIApiKey: apiKey,
            modelName: model,
            configuration: { baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
        });
    }

    private nativeWorkerProcess: ChildProcess | null = null;
    private nativeWorkerModel: string | null = null;

    // Fallback removido - usar apenas native (ONNX via worker.js)
    private pendingEmbedRequests = new Map<string, { resolve: (v: number[][]) => void; reject: (e: Error) => void }>();

    /**
     * Retorna (ou cria) um processo filho dedicado ao embedding nativo.
     * O processo é reutilizado entre chamadas para manter o modelo em cache.
     * Se o processo morrer (OOM/crash), ele é recriado na próxima chamada.
     */
    private getNativeWorker(model: string): ChildProcess {
        // Reutilizar worker existente se o modelo for o mesmo e o processo estiver vivo
        if (this.nativeWorkerProcess && !this.nativeWorkerProcess.killed && this.nativeWorkerModel === model) {
            return this.nativeWorkerProcess;
        }

        // Encerrar worker anterior se existir com modelo diferente
        if (this.nativeWorkerProcess && !this.nativeWorkerProcess.killed) {
            try { this.nativeWorkerProcess.send({ type: 'exit' }); } catch { /* ignore */ }
            this.nativeWorkerProcess = null;
        }

        // Caminho do worker compilado em dist/ (copiado pelo nest-cli assets)
        const workerPath = require('path').join(__dirname, 'embedding.worker.js');
        this.logger.log(`[NativeEmbed] Criando processo filho de embedding: ${workerPath} (modelo: ${model})`);

        const worker = require('child_process').fork(workerPath, [], {
            silent: false, // herdar stdout/stderr para aparecer nos logs do Railway
            execArgv: ['--max-old-space-size=512'], // limite de RAM do processo filho
        }) as ChildProcess;

        worker.on('message', (msg: any) => {
            if (!msg || !msg.type) return;

            if (msg.type === 'log') {
                if (msg.level === 'info') this.logger.log(msg.message);
                else if (msg.level === 'warn') this.logger.warn(msg.message);
                else this.logger.error(msg.message);
                return;
            }

            if (msg.type === 'ready') {
                this.logger.log(`[NativeEmbed] Worker pronto (pid ${worker.pid})`);
                return;
            }

            const pending = this.pendingEmbedRequests.get(msg.id);
            if (!pending) return;
            this.pendingEmbedRequests.delete(msg.id);

            if (msg.type === 'result') {
                pending.resolve(msg.embeddings);
            } else if (msg.type === 'error') {
                pending.reject(new Error(msg.message));
            }
        });

        worker.on('exit', (code, signal) => {
            this.logger.warn(`[NativeEmbed] Worker encerrado (code=${code}, signal=${signal})`);
            // Rejeitar todas as requisições pendentes
            for (const [id, pending] of this.pendingEmbedRequests) {
                pending.reject(new Error('Worker de embedding encerrado inesperadamente'));
                this.pendingEmbedRequests.delete(id);
            }
            // Limpar referência para que a próxima chamada crie um novo worker
            if (this.nativeWorkerProcess === worker) this.nativeWorkerProcess = null;
        });

        worker.on('error', (err) => {
            this.logger.error(`[NativeEmbed] Erro no worker: ${err.message}`);
        });

        this.nativeWorkerProcess = worker;
        this.nativeWorkerModel = model;
        return worker;
    }

    private createNativeEmbeddings(model: string): Embeddings {
        return {
            embedDocuments: async (docs: string[]): Promise<number[][]> => {
                return this.runInNativeWorker(model, docs);
            },
            embedQuery: async (query: string): Promise<number[]> => {
                const results = await this.runInNativeWorker(model, [query]);
                return results[0];
            },
        } as Embeddings;
    }

    private runInNativeWorker(model: string, texts: string[]): Promise<number[][]> {
        return new Promise((resolve, reject) => {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const worker = this.getNativeWorker(model);

            const timeout = setTimeout(() => {
                this.pendingEmbedRequests.delete(id);
                reject(new Error(`Timeout (120s) ao gerar embeddings com modelo '${model}'`));
            }, 120_000);

            this.pendingEmbedRequests.set(id, {
                resolve: (embeddings) => { clearTimeout(timeout); resolve(embeddings); },
                reject: (err) => { clearTimeout(timeout); reject(err); },
            });

            try {
                worker.send({ type: 'embed', id, model, texts });
            } catch (err) {
                this.pendingEmbedRequests.delete(id);
                clearTimeout(timeout);
                reject(new Error(`Falha ao enviar mensagem ao worker de embedding: ${err.message}`));
            }
        });
    }


    /**
     * Retorna todos os providers disponíveis (com base nas env vars configuradas).
     */
    getAvailableProviders(): { id: string; name: string; models: EmbeddingModelConfig[] }[] {
        return EMBEDDING_PROVIDERS.filter(p => {
            if (p.id === 'ollama' || p.id === 'native') return true; // Sempre disponível (local)
            return !!this.configService.get<string>(p.envKey);
        }).map(p => ({ id: p.id, name: p.name, models: p.models }));
    }
}
