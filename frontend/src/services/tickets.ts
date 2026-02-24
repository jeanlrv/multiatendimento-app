import { api } from './api';

export interface BulkActionParams {
    ids: string[];
    action: 'RESOLVE' | 'PAUSE' | 'ASSIGN' | 'DELETE';
    targetId?: string;
}

export const ticketsService = {
    findAll: async (params: any) => {
        const response = await api.get('/tickets', { params });
        return response.data;
    },

    findOne: async (id: string) => {
        const response = await api.get(`/tickets/${id}`);
        return response.data;
    },

    update: async (id: string, data: any) => {
        const response = await api.patch(`/tickets/${id}`, data);
        return response.data;
    },

    resolve: async (id: string) => {
        const response = await api.post(`/tickets/${id}/resolve`);
        return response.data;
    },

    pause: async (id: string) => {
        const response = await api.post(`/tickets/${id}/pause`);
        return response.data;
    },

    bulkAction: async (params: BulkActionParams) => {
        const response = await api.post('/tickets/bulk', params);
        return response.data;
    }
};
