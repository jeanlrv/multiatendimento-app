import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Embeddings } from '@langchain/core/embeddings';
import { OpenAIEmbeddings } from '@langchain/openai';

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
        name: 'Nativo (fastembed CPU)',
        envKey: '',
        models: [
            { id: 'all-MiniLM-L6-v2', name: 'all-MiniLM-L6-v2 (Leve ~25MB, estável, inglês)', dimensions: 384 },
            { id: 'bge-small-en-v1.5', name: 'BGE Small EN v1.5 (Leve ~25MB, alta qualidade, inglês)', dimensions: 384 },
            { id: 'multilingual-e5-large', name: 'Multilingual E5 Large (PT-BR, requer ≥1GB RAM)', dimensions: 1024 },
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
    {
        id: 'openrouter',
        name: 'OpenRouter',
        envKey: 'OPENROUTER_API_KEY',
        baseURL: 'https://openrouter.ai/api/v1',
        models: [
            { id: 'openai/text-embedding-3-small', name: 'text-embedding-3-small via OpenRouter (Econômico)', dimensions: 1536 },
            { id: 'openai/text-embedding-3-large', name: 'text-embedding-3-large via OpenRouter (Alta qualidade)', dimensions: 3072 },
            { id: 'mistral/mistral-embed', name: 'Mistral Embed via OpenRouter', dimensions: 1024 },
            { id: 'google/text-embedding-004', name: 'Google text-embedding-004 via OpenRouter', dimensions: 768 },
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
            case 'openrouter':
                return this.createOpenRouterEmbeddings(model, apiKeyOverride);
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

    private createOpenRouterEmbeddings(model: string, apiKeyOverride?: string): Embeddings {
        const apiKey = apiKeyOverride || this.configService.get<string>('OPENROUTER_API_KEY');
        if (!apiKey) throw new Error('OPENROUTER_API_KEY não configurada. Configure em Configurações > IA & Modelos.');
        // OpenRouter expõe endpoint compatível com OpenAI para embeddings
        return new OpenAIEmbeddings({
            openAIApiKey: apiKey,
            modelName: model,
            configuration: {
                baseURL: 'https://openrouter.ai/api/v1',
                defaultHeaders: {
                    'HTTP-Referer': 'https://kszap.com',
                    'X-Title': 'KSZap',
                },
            },
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

    /**
     * Cache de modelos fastembed carregados (singleton por modelo).
     * Chave: model ID normalizado (fastembed enum value).
     */
    private fastEmbedCache = new Map<string, any>();

    /** Mapeia IDs de modelo (user-facing) para o enum value do fastembed */
    private readonly NATIVE_MODEL_MAP: Record<string, string> = {
        'all-MiniLM-L6-v2': 'fast-all-MiniLM-L6-v2',
        'bge-small-en-v1.5': 'fast-bge-small-en-v1.5',
        'multilingual-e5-large': 'fast-multilingual-e5-large',
        // Compatibilidade com IDs antigos (Xenova/)
        'Xenova/all-MiniLM-L6-v2': 'fast-all-MiniLM-L6-v2',
        'Xenova/bge-micro-v2': 'fast-all-MiniLM-L6-v2',
    };

    /**
     * Retorna (ou cria e cacheia) uma instância FlagEmbedding do fastembed.
     * Usa onnxruntime-node (binários nativos Linux) — sem WASM, sem SharedArrayBuffer.
     */
    private async getOrCreateFastEmbedModel(modelId: string): Promise<any> {
        const fastModelId = this.NATIVE_MODEL_MAP[modelId] || 'fast-all-MiniLM-L6-v2';

        if (this.fastEmbedCache.has(fastModelId)) {
            return this.fastEmbedCache.get(fastModelId);
        }

        const { FlagEmbedding } = await import('fastembed');
        const cacheDir = this.configService.get<string>('FASTEMBED_CACHE_PATH') || '/tmp/fastembed_cache';

        this.logger.log(`[NativeEmbed] Inicializando fastembed modelo "${fastModelId}" (cache: ${cacheDir})`);

        const model = await FlagEmbedding.init({
            model: fastModelId as any,
            cacheDir,
            showDownloadProgress: false,
        });

        this.fastEmbedCache.set(fastModelId, model);
        this.logger.log(`[NativeEmbed] Modelo "${fastModelId}" carregado via onnxruntime-node.`);
        return model;
    }

    private createNativeEmbeddings(modelId: string): Embeddings {
        return {
            embedDocuments: async (docs: string[]): Promise<number[][]> => {
                const flagModel = await this.getOrCreateFastEmbedModel(modelId);
                const results: number[][] = [];
                for await (const batch of flagModel.embed(docs, 32)) {
                    for (const vec of batch) results.push(Array.from(vec));
                }
                return results;
            },
            embedQuery: async (query: string): Promise<number[]> => {
                const flagModel = await this.getOrCreateFastEmbedModel(modelId);
                const results: number[][] = [];
                for await (const batch of flagModel.embed([query], 1)) {
                    for (const vec of batch) results.push(Array.from(vec));
                }
                return results[0];
            },
        } as Embeddings;
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
