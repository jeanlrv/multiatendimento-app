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
        ],
    },
    {
        id: 'ollama',
        name: 'Ollama (Local)',
        envKey: 'OLLAMA_BASE_URL',
        baseURL: 'http://localhost:11434/v1',
        models: [
            { id: 'ollama:llama3.2', name: 'Llama 3.2 (Local)', contextWindow: 128000 },
            { id: 'ollama:mistral', name: 'Mistral (Local)', contextWindow: 32768 },
        ],
    },
];

@Injectable()
export class LLMProviderFactory {
    private readonly logger = new Logger(LLMProviderFactory.name);

    constructor(private configService: ConfigService) { }

    /**
     * Cria uma instância do modelo LLM correto baseado no modelId.
     * O modelId pode usar prefixos como "groq:", "openrouter:", "ollama:" 
     * para providers OpenAI-compat, ou nomes diretos como "gpt-4o", "claude-*", "gemini-*".
     * 
     * Para multimodal, use createMultimodalModel() em vez disso.
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
            default:
                // OpenAI e todos os OpenAI-compat (DeepSeek, Groq, OpenRouter, Mistral, Ollama)
                return this.createOpenAICompatModel(provider, actualModelName, temperature);
        }
    }

    /**
     * Detecta qual provider usar baseado no modelId.
     */
    private detectProvider(modelId: string): LLMProviderConfig {
        // Prefixos explícitos
        if (modelId.startsWith('groq:')) return LLM_PROVIDERS.find(p => p.id === 'groq')!;
        if (modelId.startsWith('openrouter:')) return LLM_PROVIDERS.find(p => p.id === 'openrouter')!;
        if (modelId.startsWith('ollama:')) return LLM_PROVIDERS.find(p => p.id === 'ollama')!;

        // Detecção por padrão do nome
        if (modelId.startsWith('claude')) return LLM_PROVIDERS.find(p => p.id === 'anthropic')!;
        if (modelId.startsWith('gemini')) return LLM_PROVIDERS.find(p => p.id === 'gemini')!;
        if (modelId.startsWith('deepseek')) return LLM_PROVIDERS.find(p => p.id === 'deepseek')!;
        if (modelId.startsWith('mistral')) return LLM_PROVIDERS.find(p => p.id === 'mistral')!;

        // Default: OpenAI
        return LLM_PROVIDERS.find(p => p.id === 'openai')!;
    }

    /**
     * Remove o prefixo do provider do modelId (ex: "groq:llama-3.1-8b" → "llama-3.1-8b")
     */
    private stripPrefix(modelId: string): string {
        const prefixes = ['groq:', 'openrouter:', 'ollama:'];
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
        if (!apiKey && provider.id !== 'ollama') {
            throw new Error(`Chave de API não configurada para ${provider.name}. Configure a variável ${provider.envKey}.`);
        }

        const config: any = {
            modelName: modelName,
            temperature: temperature,
            openAIApiKey: apiKey || 'ollama', // Ollama não precisa de key
        };

        if (provider.baseURL) {
            config.configuration = { baseURL: provider.baseURL };
        }

        return new ChatOpenAI(config);
    }

    /**
     * Cria modelo Anthropic via LangChain.
     */
    private createAnthropicModel(modelName: string, temperature: number): BaseChatModel {
        const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
        if (!apiKey) {
            throw new Error('Chave de API Anthropic não configurada. Configure ANTHROPIC_API_KEY.');
        }

        // Import dinâmico para evitar erro se o pacote não estiver instalado
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
     * Retorna todos os providers e modelos disponíveis (baseado nas env vars configuradas).
     */
    getAvailableModels(): { provider: string; providerName: string; models: { id: string; name: string; multimodal?: boolean }[] }[] {
        return LLM_PROVIDERS
            .filter(p => {
                if (p.id === 'ollama') return !!this.configService.get<string>(p.envKey);
                return !!this.configService.get<string>(p.envKey);
            })
            .map(p => ({
                provider: p.id,
                providerName: p.name,
                models: p.models.map(m => ({
                    ...m,
                    multimodal: MULTIMODAL_MODELS.includes(m.id),
                })),
            }));
    }
}
