import { api } from './api';

export interface CannedResponse {
    id: string;
    companyId: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
}

export const cannedResponsesService = {
    findAll: (search?: string): Promise<CannedResponse[]> =>
        api.get('/canned-responses', { params: search ? { q: search } : {} }).then(r => r.data),

    create: (data: { title: string; content: string }): Promise<CannedResponse> =>
        api.post('/canned-responses', data).then(r => r.data),

    update: (id: string, data: { title?: string; content?: string }): Promise<CannedResponse> =>
        api.patch(`/canned-responses/${id}`, data).then(r => r.data),

    remove: (id: string): Promise<void> =>
        api.delete(`/canned-responses/${id}`).then(() => undefined),
};
