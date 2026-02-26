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
};
