import { api } from './api';

export interface AIAgent {
    id: string;
    name: string;
    avatar?: string;
    description?: string;
    prompt?: string;
    modelId?: string;
    temperature?: number;
    configuration?: any;
    isActive: boolean;
    knowledgeBaseId?: string;
    embeddingProvider?: string;
    embeddingModel?: string;
    allowInInternalChat?: boolean;
    allowModelDowngrade?: boolean;
    limitTokensPerDay?: number;
    // Embed configuration
    embedId?: string;
    embedEnabled?: boolean;
    embedBrandColor?: string;
    embedBrandLogo?: string | null;
    embedAgentName?: string | null;
    embedWelcomeMsg?: string | null;
    embedPlaceholder?: string;
    embedPosition?: string;
    embedAllowedDomains?: string[];
    embedRateLimit?: number;
    createdAt: string;
    updatedAt: string;
}


export interface AIModelOption {
    id: string;
    name: string;
    contextWindow?: number;
}

export interface AIProviderModels {
    provider: string;
    providerName: string;
    models: AIModelOption[];
}

export const AIAgentsService = {
    findAll: async (signal?: AbortSignal) => {
        const response = await api.get<AIAgent[]>('/ai/agents', { signal });
        return response.data;
    },

    create: async (data: Partial<AIAgent>) => {
        const response = await api.post<AIAgent>('/ai/agents', data);
        return response.data;
    },

    update: async (id: string, data: Partial<AIAgent>) => {
        const response = await api.patch<AIAgent>(`/ai/agents/${id}`, data);
        return response.data;
    },

    remove: async (id: string) => {
        await api.delete(`/ai/agents/${id}`);
    },

    getModels: async (signal?: AbortSignal) => {
        const response = await api.get<AIProviderModels[]>('/ai/models', { signal });
        return response.data;
    },

    getEmbeddingProviders: async (signal?: AbortSignal): Promise<{ id: string; name: string; models: { id: string; name: string; dimensions: number }[] }[]> => {
        const response = await api.get('/ai/embedding-providers', { signal });
        return response.data;
    },

    chat: async (agentId: string, message: string, history: { role: string; content: string }[] = []) => {
        const response = await api.post(`/ai/agents/${agentId}/chat`, { message, history });
        return response.data;
    },

    /** AsyncGenerator que emite eventos SSE token a token: { type: 'chunk'|'end'|'error', content?: string, message?: string } */
    streamChat: async function* (agentId: string, message: string, history: { role: string; content: string }[] = []): AsyncGenerator<{ type: string; content?: string; message?: string }> {
        const res = await fetch(`/api/ai/agents/${agentId}/chat-stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // envia httpOnly cookie (access_token) para autenticação
            body: JSON.stringify({ message, history }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Erro ao iniciar stream' }));
            throw new Error(err.message || `HTTP ${res.status}`);
        }
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop()!;
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try { yield JSON.parse(line.slice(6)) as { type: string; content?: string; message?: string }; }
                catch { /* linha malformada */ }
            }
        }
    },

    chatWithAttachment: async (agentId: string, message: string, file: File, history: { role: string; content: string }[] = []) => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('message', message);
        fd.append('history', JSON.stringify(history));
        const response = await api.post(`/ai/agents/${agentId}/chat-with-attachment`, fd);
        return response.data as { response: string };
    },

    getUsage: async () => {
        const response = await api.get('/ai/usage');
        return response.data;
    },

    getMetrics: async () => {
        const response = await api.get('/ai/metrics');
        return response.data;
    },

    // API Keys
    listApiKeys: async () => {
        const response = await api.get('/ai/api-keys');
        return response.data;
    },

    createApiKey: async (data: { name: string; agentId?: string }) => {
        const response = await api.post('/ai/api-keys', data);
        return response.data;
    },

    revokeApiKey: async (id: string) => {
        await api.delete(`/ai/api-keys/${id}`);
    },
};

