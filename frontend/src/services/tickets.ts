import { api } from './api';

export interface Message {
    id: string;
    content: string;
    fromMe: boolean;
    sentAt: string;
    messageType: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'STICKER' | 'INTERNAL';
    mediaUrl?: string;
    status?: string;
    origin?: 'AGENT' | 'CLIENT' | 'AI';
    transcription?: string;
    quotedMessageId?: string;
    quotedMessage?: {
        content: string;
        fromMe: boolean;
    };
    isEdited?: boolean;
    isDeleted?: boolean;
    replyToId?: string;
    threadId?: string;
    senderUserId?: string;
    senderAiAgentId?: string;
    senderUser?: {
        name: string;
        avatar?: string;
    };
    senderAiAgent?: {
        name: string;
        avatar?: string;
    };
}

export interface Tag {
    id: string;
    name: string;
    color: string;
}

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
    tags?: string | string[];
    startDate?: string;
    endDate?: string;
    contactId?: string;
    page?: number;
    limit?: number;
}

export interface Ticket {
    id: string;
    status: string;
    priority: string;
    subject: string;
    updatedAt: string;
    createdAt: string;
    contactId: string;
    companyId: string;
    contact: {
        id?: string;
        name: string;
        phoneNumber: string;
        information?: string;
        profilePicture?: string;
    };
    department: {
        id: string;
        name: string;
        emoji?: string;
        color?: string;
        slaFirstResponseMin?: number | null;
        slaResolutionMin?: number | null;
    };
    firstResponseAt?: string | null;
    resolvedAt?: string | null;
    mode: 'AI' | 'HUMANO' | 'HIBRIDO';
    unreadMessages: number;
    notes?: string;
    evaluation?: {
        aiSentiment?: string;
        aiSentimentScore?: number;
        aiSummary?: string;
        aiJustification?: string;
    };
    assignedUser?: {
        id: string;
        name: string;
        avatar?: string;
    };
    tags?: {
        id: string;
        tag: {
            id: string;
            name: string;
            color: string;
        };
    }[];
    lastMessageAt?: string;
    realtimeSentiment?: string | null;
    realtimeSentimentScore?: number | null;
    [key: string]: any;
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
