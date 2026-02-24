import { api } from './api';

export interface AIAgent {
    id: string;
    name: string;
    description?: string;
    anythingllmWorkspaceId: string;
    configuration?: any;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
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
    }
};
