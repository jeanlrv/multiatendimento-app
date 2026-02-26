import { api } from './api';

export interface QuickReply {
    id: string;
    shortcut: string;
    content: string;
    companyId: string;
    createdAt: string;
    updatedAt: string;
}

export const QuickRepliesService = {
    findAll: async () => {
        const response = await api.get<QuickReply[]>('/quick-replies');
        return response.data;
    },

    create: async (data: Partial<QuickReply>) => {
        const response = await api.post<QuickReply>('/quick-replies', data);
        return response.data;
    },

    update: async (id: string, data: Partial<QuickReply>) => {
        const response = await api.patch<QuickReply>(`/quick-replies/${id}`, data);
        return response.data;
    },

    remove: async (id: string) => {
        await api.delete(`/quick-replies/${id}`);
    }
};
