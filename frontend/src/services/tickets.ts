import { api } from './api';

export interface BulkActionParams {
    ids: string[];
    action: 'RESOLVE' | 'PAUSE' | 'ASSIGN' | 'DELETE';
    targetId?: string;
}

export interface TicketFilters {
    status?: string | string[];
    departmentId?: string;
    assignedUserId?: string;
    search?: string;
    priority?: string;
    connectionId?: string;
    page?: number;
    limit?: number;
}

export interface Ticket {
    id: string;
    status: string;
    companyId: string;
    departmentId?: string;
    assignedUserId?: string;
    contactId: string;
    createdAt: string;
    updatedAt: string;
    [key: string]: unknown;
}

export interface PaginatedTickets {
    data: Ticket[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface BulkActionResult {
    success: boolean;
    count: number;
    message?: string;
}

export const ticketsService = {
    findAll: async (params: TicketFilters, signal?: AbortSignal): Promise<PaginatedTickets> => {
        const response = await api.get<PaginatedTickets>('/tickets', { params, signal });
        return response.data;
    },

    findOne: async (id: string): Promise<Ticket> => {
        const response = await api.get<Ticket>(`/tickets/${id}`);
        return response.data;
    },

    update: async (id: string, data: Partial<Ticket>): Promise<Ticket> => {
        const response = await api.patch<Ticket>(`/tickets/${id}`, data);
        return response.data;
    },

    resolve: async (id: string): Promise<Ticket> => {
        const response = await api.post<Ticket>(`/tickets/${id}/resolve`);
        return response.data;
    },

    pause: async (id: string): Promise<Ticket> => {
        const response = await api.post<Ticket>(`/tickets/${id}/pause`);
        return response.data;
    },

    assign: async (id: string, userId: string): Promise<Ticket> => {
        const response = await api.post<Ticket>(`/tickets/${id}/assign`, { userId });
        return response.data;
    },

    bulkAction: async (params: BulkActionParams): Promise<BulkActionResult> => {
        const response = await api.post<BulkActionResult>('/tickets/bulk', params);
        return response.data;
    }
};
