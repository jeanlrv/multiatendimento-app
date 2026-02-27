import { api } from './api';

export interface AIAgent {
    id: string;
    name: string;
    description?: string;
    prompt?: string;
    modelId?: string;
    temperature?: number;
    configuration?: any;
    isActive: boolean;
    knowledgeBaseId?: string;
    embeddingProvider?: string;
    embeddingModel?: string;
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
    findAll: async () => {
        const response = await api.get<AIAgent[]>('/ai/agents');
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

    getModels: async () => {
        const response = await api.get<AIProviderModels[]>('/ai/models');
        return response.data;
    },

    chat: async (agentId: string, message: string, history: { role: string; content: string }[] = []) => {
        const response = await api.post(`/ai/agents/${agentId}/chat`, { message, history });
        return response.data;
    },

    streamChat: async (agentId: string, message: string, history: { role: string; content: string }[] = []) => {
        const response = await api.post(`/ai/agents/${agentId}/stream`, { message, history });
        return response.data;
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

