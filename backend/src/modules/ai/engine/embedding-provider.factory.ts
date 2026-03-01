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
        id: 'native',
        name: 'Nativo (built-in CPU)',
        envKey: '',
        models: [
            { id: 'Xenova/all-MiniLM-L6-v2', name: 'all-MiniLM-L6-v2 (Padrão e Rápido)', dimensions: 384 },
            { id: 'Xenova/bge-micro-v2', name: 'bge-micro-v2 (Muito Leve e Rápido)', dimensions: 384 },
        ],
    },
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
];

// Cache singleton de pipelines nativos para evitar recarregamento a cada chamada
const nativePipelineCache = new Map<string, Promise<any>>();

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
        const baseURL = (baseUrlOverride || this.configService.get<string>('ANYTHINGLLM_BASE_URL') || 'http://localhost:3001/api/v1')
            .replace(/\/api\/v1\/?$/, '') + '/api/v1';
        if (!apiKey) throw new Error('ANYTHINGLLM_API_KEY não configurada. Configure em Configurações > IA & Modelos.');
        // AnythingLLM expõe endpoint OpenAI-compat para embeddings
        return new OpenAIEmbeddings({
            openAIApiKey: apiKey,
            modelName: model,
            configuration: { baseURL: `${baseURL}/openai` },
        });
    }

    private createNativeEmbeddings(model: string): Embeddings {
        // Retorna um wrapper LangChain que reutiliza o pipeline em cache
        const getExtractor = async (): Promise<any> => {
            if (!nativePipelineCache.has(model)) {
                const startTime = Date.now();
                this.logger.log(`[NativeEmbed] Carregando pipeline '${model}' sob demanda...`);
                try {
                    const { pipeline, env } = await import('@xenova/transformers');

                    env.allowLocalModels = false;
                    env.useBrowserCache = false;
                    env.allowRemoteModels = true;
                    (env as any).remoteHost = 'https://huggingface.co';

                    // Replicar configurações de segurança no carregamento sob demanda
                    if (env.backends && env.backends.onnx) {
                        env.backends.onnx.wasm.numThreads = 1;
                        env.backends.onnx.wasm.proxy = false;
                        env.backends.onnx.gpu = false;
                        if ((env.backends.onnx.wasm as any).wasmFeatures) {
                            (env.backends.onnx.wasm as any).wasmFeatures.simd = false;
                        }
                        (env.backends.onnx.wasm as any).simd = false;
                    }

                    const p = pipeline('feature-extraction', model, {
                        quantized: true,
                    });

                    nativePipelineCache.set(model, p);

                    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                    this.logger.log(`[NativeEmbed] Pipeline '${model}' carregado com sucesso em ${duration}s`);
                } catch (error) {
                    this.logger.error(`[NativeEmbed] Falha fatal ao carregar pipeline nativo: ${error.message}`);
                    nativePipelineCache.delete(model);
                    throw new Error(`Modelo de embedding nativo indisponível: ${error.message}`);
                }
            }
            return nativePipelineCache.get(model)!;
        };

        return {
            embedDocuments: async (docs: string[]): Promise<number[][]> => {
                try {
                    const extractor = await getExtractor();
                    const embeddings: number[][] = [];
                    for (const text of docs) {
                        const output = await extractor(text, { pooling: 'mean', normalize: true });
                        embeddings.push(Array.from(output.data as Float32Array));
                    }
                    return embeddings;
                } catch (error) {
                    this.logger.error(`[NativeEmbed] Erro ao gerar embeddings de documentos: ${error.message}`);
                    throw error;
                }
            },
            embedQuery: async (query: string): Promise<number[]> => {
                try {
                    const extractor = await getExtractor();
                    const output = await extractor(query, { pooling: 'mean', normalize: true });
                    return Array.from(output.data as Float32Array);
                } catch (error) {
                    this.logger.error(`[NativeEmbed] Erro ao gerar embedding de query: ${error.message}`);
                    throw error;
                }
            }
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
