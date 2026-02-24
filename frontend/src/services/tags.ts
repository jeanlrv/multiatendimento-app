import { api } from './api';

export interface Tag {
    id: string;
    name: string;
    color: string;
    createdAt: string;
}

export const TagsService = {
    findAll: async () => {
        const response = await api.get<Tag[]>('/tags');
        return response.data;
    },

    create: async (data: { name: string; color?: string }) => {
        const response = await api.post<Tag>('/tags', data);
        return response.data;
    },

    update: async (id: string, data: Partial<{ name: string; color?: string }>) => {
        const response = await api.patch<Tag>(`/tags/${id}`, data);
        return response.data;
    },

    remove: async (id: string) => {
        await api.delete(`/tags/${id}`);
    }
};
