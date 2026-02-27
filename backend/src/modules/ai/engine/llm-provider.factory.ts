import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';

/**
 * Definição de um provedor de IA suportado.
 */
export interface LLMProviderConfig {
    id: string;
    name: string;
    envKey: string;        // Variável de ambiente para a API key
    baseURL?: string;      // Override de URL (para OpenAI-compat)
    models: { id: string; name: string; contextWindow?: number }[];
}

/**
 * Lista de modelos que suportam multimodal (Vision).
 */
export const MULTIMODAL_MODELS = [
    // OpenAI
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4.1',
    'gpt-4.1-mini',
    'o3-mini',
    // Gemini
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
];

/**
 * Verifica se um modelo suporta multimodal (Vision).
 */
export function isMultimodalModel(modelId: string): boolean {
    const cleanModelId = modelId.split(':').pop() || modelId;
    return MULTIMODAL_MODELS.includes(cleanModelId);
}

/**
 * Registry de todos os providers suportados.
 */
export const LLM_PROVIDERS: LLMProviderConfig[] = [
    {
        id: 'openai',
        name: 'OpenAI',
        envKey: 'OPENAI_API_KEY',
        models: [
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Rápido & Econômico)', contextWindow: 128000 },
            { id: 'gpt-4o', name: 'GPT-4o (Poderoso & Preciso)', contextWindow: 128000 },
            { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', contextWindow: 1047576 },
            { id: 'gpt-4.1', name: 'GPT-4.1', contextWindow: 1047576 },
            { id: 'o3-mini', name: 'O3 Mini (Raciocínio)', contextWindow: 200000 },
        ],
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        envKey: 'ANTHROPIC_API_KEY',
        models: [
            { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000 },
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000 },
            { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Rápido)', contextWindow: 200000 },
        ],
    },
    {
        id: 'gemini',
        name: 'Google Gemini',
        envKey: 'GEMINI_API_KEY',
        models: [
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1048576 },
            { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite (Econômico)', contextWindow: 1048576 },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2097152 },
        ],
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        envKey: 'DEEPSEEK_API_KEY',
        baseURL: 'https://api.deepseek.com/v1',
        models: [
            { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)', contextWindow: 64000 },
            { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)', contextWindow: 64000 },
        ],
    },
    {
        id: 'groq',
        name: 'Groq',
        envKey: 'GROQ_API_KEY',
        baseURL: 'https://api.groq.com/openai/v1',
        models: [
            { id: 'groq:llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Versatile)', contextWindow: 128000 },
            { id: 'groq:llama-3.1-8b-instant', name: 'Llama 3.1 8B (Ultra Rápido)', contextWindow: 128000 },
            { id: 'groq:mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768 },
        ],
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        envKey: 'OPENROUTER_API_KEY',
        baseURL: 'https://openrouter.ai/api/v1',
        models: [
            { id: 'openrouter:auto', name: 'Auto (Melhor custo-benefício)', contextWindow: 128000 },
            { id: 'openrouter:google/gemini-2.0-flash-exp:free', name: 'Gemini Flash (Grátis)', contextWindow: 1048576 },
            { id: 'openrouter:meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', contextWindow: 128000 },
            { id: 'openrouter:deepseek/deepseek-r1', name: 'DeepSeek R1', contextWindow: 128000 },
        ],
    },
    {
        id: 'mistral',
        name: 'Mistral AI',
        envKey: 'MISTRAL_API_KEY',
        baseURL: 'https://api.mistral.ai/v1',
        models: [
            { id: 'mistral-large-latest', name: 'Mistral Large', contextWindow: 128000 },
            { id: 'mistral-small-latest', name: 'Mistral Small (Econômico)', contextWindow: 128000 },
            { id: 'codestral-latest', name: 'Codestral (Código)', contextWindow: 256000 },
        ],
    },
    {
        id: 'azure',
        name: 'Azure OpenAI',
        envKey: 'AZURE_OPENAI_API_KEY',
        models: [
            { id: 'azure:gpt-4o', name: 'GPT-4o (Azure)', contextWindow: 128000 },
            { id: 'azure:gpt-4o-mini', name: 'GPT-4o Mini (Azure)', contextWindow: 128000 },
            { id: 'azure:gpt-4', name: 'GPT-4 (Azure)', contextWindow: 8192 },
            { id: 'azure:gpt-35-turbo', name: 'GPT-3.5 Turbo (Azure)', contextWindow: 16385 },
        ],
    },
    {
        id: 'together',
        name: 'Together AI',
        envKey: 'TOGETHER_API_KEY',
        baseURL: 'https://api.together.xyz/v1',
        models: [
            { id: 'together:meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', contextWindow: 131072 },
            { id: 'together:meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', name: 'Llama 3.1 8B Turbo', contextWindow: 131072 },
            { id: 'together:mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B', contextWindow: 32768 },
            { id: 'together:deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3', contextWindow: 65536 },
        ],
    },
    {
        id: 'lmstudio',
        name: 'LM Studio / LocalAI',
        envKey: 'LMSTUDIO_BASE_URL',
        baseURL: 'http://localhost:1234/v1',
        models: [
            { id: 'lmstudio:local-model', name: 'Modelo Local (configurado no LM Studio)', contextWindow: 4096 },
        ],
    },
    {
        id: 'perplexity',
        name: 'Perplexity AI',
        envKey: 'PERPLEXITY_API_KEY',
        baseURL: 'https://api.perplexity.ai',
        models: [
            { id: 'perplexity:llama-3.1-sonar-huge-128k-online', name: 'Sonar Huge (Online)', contextWindow: 127072 },
            { id: 'perplexity:llama-3.1-sonar-large-128k-online', name: 'Sonar Large (Online)', contextWindow: 127072 },
            { id: 'perplexity:llama-3.1-sonar-small-128k-online', name: 'Sonar Small (Online)', contextWindow: 127072 },
        ],
    },
    {
        id: 'xai',
        name: 'xAI Grok',
        envKey: 'XAI_API_KEY',
        baseURL: 'https://api.x.ai/v1',
        models: [
            { id: 'xai:grok-2-latest', name: 'Grok 2', contextWindow: 131072 },
            { id: 'xai:grok-2-vision-latest', name: 'Grok 2 Vision', contextWindow: 32768 },
            { id: 'xai:grok-beta', name: 'Grok Beta', contextWindow: 131072 },
        ],
    },
    {
        id: 'cohere',
        name: 'Cohere',
        envKey: 'COHERE_API_KEY',
        models: [
            { id: 'cohere:command-r-plus', name: 'Command R+ (Poderoso)', contextWindow: 128000 },
            { id: 'cohere:command-r', name: 'Command R (Equilibrado)', contextWindow: 128000 },
            { id: 'cohere:command-light', name: 'Command Light (Econômico)', contextWindow: 4096 },
        ],
    },
    {
        id: 'huggingface',
        name: 'HuggingFace',
        envKey: 'HUGGINGFACE_API_KEY',
        models: [
            { id: 'huggingface:meta-llama/Meta-Llama-3-8B-Instruct', name: 'Llama 3 8B Instruct', contextWindow: 8192 },
            { id: 'huggingface:mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B Instruct', contextWindow: 32768 },
            { id: 'huggingface:microsoft/Phi-3-mini-4k-instruct', name: 'Phi-3 Mini (Leve)', contextWindow: 4096 },
        ],
    },
    {
        id: 'ollama',
        name: 'Ollama (Local)',
        envKey: 'OLLAMA_BASE_URL',
        baseURL: 'http://localhost:11434/v1',
        models: [
            { id: 'ollama:llama3.2', name: 'Llama 3.2 (Local)', contextWindow: 128000 },
            { id: 'ollama:llama3.1', name: 'Llama 3.1 (Local)', contextWindow: 128000 },
            { id: 'ollama:mistral', name: 'Mistral (Local)', contextWindow: 32768 },
            { id: 'ollama:qwen2.5', name: 'Qwen 2.5 (Local)', contextWindow: 32768 },
            { id: 'ollama:phi4', name: 'Phi-4 (Local, Leve)', contextWindow: 16384 },
            { id: 'ollama:deepseek-r1', name: 'DeepSeek R1 (Local)', contextWindow: 32768 },
        ],
    },
];

@Injectable()
export class LLMProviderFactory {
    private readonly logger = new Logger(LLMProviderFactory.name);

    constructor(private configService: ConfigService) { }

    /**
     * Cria uma instância do modelo LLM correto baseado no modelId.
     * O modelId pode usar prefixos como "groq:", "openrouter:", "ollama:", "azure:", etc.
     * para identificar o provider, ou nomes diretos como "gpt-4o", "claude-*", "gemini-*".
     */
    createModel(modelId: string, temperature: number = 0.7): BaseChatModel {
        const provider = this.detectProvider(modelId);
        const actualModelName = this.stripPrefix(modelId);

        this.logger.log(`Criando modelo: ${modelId} (provider: ${provider.id}, model: ${actualModelName})`);

        switch (provider.id) {
            case 'anthropic':
                return this.createAnthropicModel(actualModelName, temperature);
            case 'gemini':
                return this.createGeminiModel(actualModelName, temperature);
            case 'azure':
                return this.createAzureModel(actualModelName, temperature);
            case 'cohere':
                return this.createCohereModel(actualModelName, temperature);
            case 'huggingface':
                return this.createHuggingFaceModel(actualModelName, temperature);
            default:
                // OpenAI e todos os OpenAI-compat
                return this.createOpenAICompatModel(provider, actualModelName, temperature);
        }
    }

    /**
     * Detecta qual provider usar baseado no modelId.
     */
    private detectProvider(modelId: string): LLMProviderConfig {
        // Prefixos explícitos
        const prefixMap: Record<string, string> = {
            'groq:': 'groq',
            'openrouter:': 'openrouter',
            'ollama:': 'ollama',
            'azure:': 'azure',
            'together:': 'together',
            'lmstudio:': 'lmstudio',
            'perplexity:': 'perplexity',
            'xai:': 'xai',
            'cohere:': 'cohere',
            'huggingface:': 'huggingface',
        };

        for (const [prefix, providerId] of Object.entries(prefixMap)) {
            if (modelId.startsWith(prefix)) {
                return LLM_PROVIDERS.find(p => p.id === providerId)!;
            }
        }

        // Detecção por padrão do nome
        if (modelId.startsWith('claude')) return LLM_PROVIDERS.find(p => p.id === 'anthropic')!;
        if (modelId.startsWith('gemini')) return LLM_PROVIDERS.find(p => p.id === 'gemini')!;
        if (modelId.startsWith('deepseek')) return LLM_PROVIDERS.find(p => p.id === 'deepseek')!;
        if (modelId.startsWith('mistral') || modelId.startsWith('codestral')) return LLM_PROVIDERS.find(p => p.id === 'mistral')!;

        // Default: OpenAI
        return LLM_PROVIDERS.find(p => p.id === 'openai')!;
    }

    /**
     * Remove o prefixo do provider do modelId (ex: "groq:llama-3.1-8b" → "llama-3.1-8b")
     */
    private stripPrefix(modelId: string): string {
        const prefixes = ['groq:', 'openrouter:', 'ollama:', 'azure:', 'together:', 'lmstudio:', 'perplexity:', 'xai:', 'cohere:', 'huggingface:'];
        for (const prefix of prefixes) {
            if (modelId.startsWith(prefix)) return modelId.substring(prefix.length);
        }
        return modelId;
    }

    /**
     * Cria modelo OpenAI ou OpenAI-compatível.
     */
    private createOpenAICompatModel(
        provider: LLMProviderConfig,
        modelName: string,
        temperature: number,
    ): BaseChatModel {
        const apiKey = this.configService.get<string>(provider.envKey);
        if (!apiKey && provider.id !== 'ollama' && provider.id !== 'lmstudio') {
            throw new Error(`Chave de API não configurada para ${provider.name}. Configure a variável ${provider.envKey}.`);
        }

        const baseURL = provider.id === 'lmstudio'
            ? (this.configService.get<string>('LMSTUDIO_BASE_URL') || provider.baseURL)
            : provider.id === 'ollama'
                ? (this.configService.get<string>('OLLAMA_BASE_URL') || provider.baseURL)
                : provider.baseURL;

        const config: any = {
            modelName: modelName,
            temperature: temperature,
            openAIApiKey: apiKey || 'local', // LM Studio / Ollama não precisam de key real
        };

        if (baseURL) {
            config.configuration = { baseURL };
        }

        return new ChatOpenAI(config);
    }

    /**
     * Cria modelo Azure OpenAI.
     */
    private createAzureModel(modelName: string, temperature: number): BaseChatModel {
        const apiKey = this.configService.get<string>('AZURE_OPENAI_API_KEY');
        const endpoint = this.configService.get<string>('AZURE_OPENAI_ENDPOINT');
        const deploymentName = this.configService.get<string>('AZURE_OPENAI_DEPLOYMENT_NAME') || modelName;

        if (!apiKey || !endpoint) {
            throw new Error('AZURE_OPENAI_API_KEY ou AZURE_OPENAI_ENDPOINT não configurados.');
        }

        const { AzureChatOpenAI } = require('@langchain/openai');
        return new AzureChatOpenAI({
            azureOpenAIApiKey: apiKey,
            azureOpenAIApiInstanceName: endpoint.replace('https://', '').replace('.openai.azure.com/', '').replace('.openai.azure.com', ''),
            azureOpenAIApiDeploymentName: deploymentName,
            azureOpenAIApiVersion: '2024-05-01-preview',
            temperature,
        });
    }

    /**
     * Cria modelo Anthropic via LangChain.
     */
    private createAnthropicModel(modelName: string, temperature: number): BaseChatModel {
        const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
        if (!apiKey) {
            throw new Error('Chave de API Anthropic não configurada. Configure ANTHROPIC_API_KEY.');
        }
        const { ChatAnthropic } = require('@langchain/anthropic');
        return new ChatAnthropic({
            modelName: modelName,
            temperature: temperature,
            anthropicApiKey: apiKey,
        });
    }

    /**
     * Cria modelo Google Gemini via LangChain.
     */
    private createGeminiModel(modelName: string, temperature: number): BaseChatModel {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) {
            throw new Error('Chave de API Gemini não configurada. Configure GEMINI_API_KEY.');
        }
        const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
        return new ChatGoogleGenerativeAI({
            modelName: modelName,
            temperature: temperature,
            apiKey: apiKey,
        });
    }

    /**
     * Cria modelo Cohere via LangChain.
     */
    private createCohereModel(modelName: string, temperature: number): BaseChatModel {
        const apiKey = this.configService.get<string>('COHERE_API_KEY');
        if (!apiKey) {
            throw new Error('Chave de API Cohere não configurada. Configure COHERE_API_KEY.');
        }
        const { ChatCohere } = require('@langchain/cohere');
        return new ChatCohere({
            model: modelName,
            temperature,
            apiKey,
        });
    }

    /**
     * Cria modelo HuggingFace via LangChain Community.
     */
    private createHuggingFaceModel(modelName: string, temperature: number): BaseChatModel {
        const apiKey = this.configService.get<string>('HUGGINGFACE_API_KEY');
        if (!apiKey) {
            throw new Error('Chave de API HuggingFace não configurada. Configure HUGGINGFACE_API_KEY.');
        }
        const { HuggingFaceInference } = require('@langchain/community/llms/hf');
        return new HuggingFaceInference({
            model: modelName,
            temperature,
            apiKey,
        }) as unknown as BaseChatModel;
    }

    /**
     * Retorna todos os providers e modelos disponíveis (baseado nas env vars configuradas).
     */
    getAvailableModels(): { provider: string; providerName: string; models: { id: string; name: string; contextWindow?: number; multimodal?: boolean }[] }[] {
        return LLM_PROVIDERS
            .filter(p => {
                // Ollama e LM Studio: disponíveis se a URL estiver configurada (ou usar padrão)
                if (p.id === 'ollama') return !!this.configService.get<string>('OLLAMA_BASE_URL');
                if (p.id === 'lmstudio') return !!this.configService.get<string>('LMSTUDIO_BASE_URL');
                return !!this.configService.get<string>(p.envKey);
            })
            .map(p => ({
                provider: p.id,
                providerName: p.name,
                models: p.models.map(m => ({
                    ...m,
                    multimodal: MULTIMODAL_MODELS.includes(m.id.split(':').pop() || m.id),
                })),
            }));
    }
}
