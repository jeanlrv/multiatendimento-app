import { api } from './api';

export interface Notification {
    id: string;
    userId: string;
    companyId: string;
    type: string; // ticket.assigned | ticket.mention | sla.breach | system
    title: string;
    body?: string;
    entityType?: string;
    entityId?: string;
    readAt?: string;
    createdAt: string;
}

export const notificationsService = {
    findUnread: (): Promise<Notification[]> =>
        api.get('/notifications').then(r => r.data),

    getCount: (): Promise<number> =>
        api.get('/notifications/count').then(r => r.data.count),

    markRead: (ids: string[]): Promise<void> =>
        api.patch('/notifications/read', { ids }).then(() => undefined),

    markAllRead: (): Promise<void> =>
        api.patch('/notifications/read-all').then(() => undefined),
};
