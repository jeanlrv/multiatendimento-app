import { api } from './api';

export interface Contact {
    id: string;
    name: string;
    phoneNumber: string;
    email: string | null;
    profilePicture: string | null;
    notes: string | null;
    information: string | null;
    riskScore: number;
    companyId: string;
    createdAt: string;
    updatedAt: string;
}

export interface ContactsResponse {
    data: Contact[];
    total: number;
    page: number;
    lastPage: number;
    metrics: {
        total: number;
        highRisk: number;
    };
}

export interface ContactPayload {
    name: string;
    phoneNumber: string;
    email?: string;
    notes?: string;
    information?: string;
}

export const ContactsService = {
    findAll: async (search?: string, page = 1, limit = 10): Promise<ContactsResponse> => {
        const response = await api.get<ContactsResponse>('/contacts', {
            params: { search: search || undefined, page, limit },
        });
        return response.data;
    },

    findOne: async (id: string): Promise<Contact> => {
        const response = await api.get<Contact>(`/contacts/${id}`);
        return response.data;
    },

    create: async (data: ContactPayload): Promise<Contact> => {
        const response = await api.post<Contact>('/contacts', data);
        return response.data;
    },

    update: async (id: string, data: Partial<ContactPayload>): Promise<Contact> => {
        const response = await api.patch<Contact>(`/contacts/${id}`, data);
        return response.data;
    },

    remove: async (id: string): Promise<void> => {
        await api.delete(`/contacts/${id}`);
    },

    exportCSV: async (): Promise<Blob> => {
        const response = await api.get('/contacts/export/csv', {
            responseType: 'blob',
        });
        return response.data;
    },
};
