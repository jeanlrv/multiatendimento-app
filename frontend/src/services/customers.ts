import { api } from './api';

export interface Customer {
    id: string;
    name: string;
    type: 'PERSON' | 'COMPANY';
    cpfCnpj?: string;
    emailPrimary?: string;
    phonePrimary?: string;
    status: 'LEAD' | 'ACTIVE' | 'INACTIVE';
    origin?: string;
    notes?: string;
    companyId: string;
    createdAt: string;
    updatedAt: string;
    contacts?: CustomerContact[];
    tags?: CustomerTagEntry[];
    customerNotes?: CustomerNote[];
    customFields?: CustomerCustomField[];
    _count?: { contacts: number };
}

export interface CustomerContact {
    id: string;
    phoneNumber: string;
    name?: string;
    email?: string;
    profilePicture?: string;
    riskScore: number;
    createdAt: string;
}

export interface CustomerTagEntry {
    customerId: string;
    tagId: string;
    tag: { id: string; name: string; color: string };
}

export interface CustomerNote {
    id: string;
    customerId: string;
    agentId: string;
    note: string;
    createdAt: string;
    agent: { id: string; name: string; avatar?: string };
}

export interface CustomerCustomField {
    id: string;
    customerId: string;
    fieldName: string;
    fieldValue?: string;
    fieldType: string;
    createdAt: string;
}

export interface CustomerConversation {
    id: string;
    status: string;
    subject: string;
    createdAt: string;
    contact: { id: string; name?: string; phoneNumber: string };
    department: { id: string; name: string; emoji?: string };
    assignedUser?: { id: string; name: string; avatar?: string };
    _count: { messages: number };
}

export const customersService = {
    findAll: async (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
        const res = await api.get('/customers', { params });
        return res.data as { data: Customer[]; total: number; page: number; lastPage: number };
    },

    findOne: async (id: string) => {
        const res = await api.get(`/customers/${id}`);
        return res.data as Customer;
    },

    findByContactId: async (contactId: string): Promise<Customer | null> => {
        // Busca o customer via contato — o backend retorna o contact com customerId
        try {
            const res = await api.get(`/contacts/${contactId}`);
            const contact = res.data;
            if (!contact?.customerId) return null;
            const custRes = await api.get(`/customers/${contact.customerId}`);
            return custRes.data as Customer;
        } catch {
            return null;
        }
    },

    create: async (data: Partial<Customer>) => {
        const res = await api.post('/customers', data);
        return res.data as Customer;
    },

    update: async (id: string, data: Partial<Customer>) => {
        const res = await api.patch(`/customers/${id}`, data);
        return res.data as Customer;
    },

    findConversations: async (id: string, page = 1, limit = 10) => {
        const res = await api.get(`/customers/${id}/conversations`, { params: { page, limit } });
        return res.data as { data: CustomerConversation[]; total: number };
    },

    addNote: async (id: string, note: string) => {
        const res = await api.post(`/customers/${id}/notes`, { note });
        return res.data as CustomerNote;
    },

    removeNote: async (customerId: string, noteId: string) => {
        await api.delete(`/customers/${customerId}/notes/${noteId}`);
    },

    addTag: async (customerId: string, tagId: string) => {
        const res = await api.post(`/customers/${customerId}/tags/${tagId}`);
        return res.data;
    },

    removeTag: async (customerId: string, tagId: string) => {
        await api.delete(`/customers/${customerId}/tags/${tagId}`);
    },

    upsertField: async (customerId: string, fieldName: string, fieldValue: string, fieldType?: string) => {
        const res = await api.post(`/customers/${customerId}/fields`, { fieldName, fieldValue, fieldType });
        return res.data;
    },

    removeField: async (customerId: string, fieldName: string) => {
        await api.delete(`/customers/${customerId}/fields/${encodeURIComponent(fieldName)}`);
    },

    linkContact: async (customerId: string, contactId: string) => {
        const res = await api.post(`/customers/${customerId}/contacts/${contactId}`);
        return res.data;
    },

    unlinkContact: async (customerId: string, contactId: string) => {
        await api.delete(`/customers/${customerId}/contacts/${contactId}`);
    },

    remove: async (id: string) => {
        await api.delete(`/customers/${id}`);
    },

    merge: async (sourceId: string, targetId: string) => {
        const res = await api.post(`/customers/${sourceId}/merge`, { targetCustomerId: targetId });
        return res.data as Customer;
    },
};
