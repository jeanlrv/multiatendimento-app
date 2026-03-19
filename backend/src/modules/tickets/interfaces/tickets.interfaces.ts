import { TicketStatus, MessageType } from '@prisma/client';

export interface TicketFilters {
    status?: TicketStatus;
    departmentId?: string;
    assignedUserId?: string;
    search?: string;
    priority?: string;
    connectionId?: string;
    tags?: string | string[];
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}

export interface TicketWithRelations {
    id: string;
    status: TicketStatus;
    companyId: string;
    departmentId?: string | null;
    assignedUserId?: string | null;
    createdAt: Date;
    updatedAt: Date;
    lastMessageAt?: Date | null;
    contact: {
        id: string;
        name: string;
        phoneNumber: string;
        email?: string | null;
    };
    department?: {
        id: string;
        name: string;
    } | null;
    assignedUser?: {
        id: string;
        name: string;
    } | null;
    tags: {
        tag: { id: string; name: string; color: string };
    }[];
}

export interface BulkActionResult {
    success: boolean;
    count: number;
    message?: string;
}
