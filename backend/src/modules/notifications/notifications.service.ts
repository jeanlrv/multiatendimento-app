import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';

export interface CreateNotificationDto {
    userId: string;
    companyId: string;
    type: string;
    title: string;
    body?: string;
    entityType?: string;
    entityId?: string;
}

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        private prisma: PrismaService,
        private chatGateway: ChatGateway,
    ) { }

    async create(data: CreateNotificationDto) {
        const notification = await this.prisma.notification.create({ data });
        // Push em tempo real via WebSocket
        this.chatGateway.server.to(`user:${data.userId}`).emit('notification', notification);
        return notification;
    }

    async findUnread(userId: string, companyId: string) {
        return this.prisma.notification.findMany({
            where: { userId, companyId, readAt: null },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }

    async markAsRead(userId: string, ids: string[]) {
        await this.prisma.notification.updateMany({
            where: { userId, id: { in: ids } },
            data: { readAt: new Date() },
        });
    }

    async markAllRead(userId: string, companyId: string) {
        await this.prisma.notification.updateMany({
            where: { userId, companyId, readAt: null },
            data: { readAt: new Date() },
        });
    }

    async getUnreadCount(userId: string, companyId: string): Promise<number> {
        return this.prisma.notification.count({ where: { userId, companyId, readAt: null } });
    }

    // ─── Event Listeners ──────────────────────────────────────────────────────

    @OnEvent('ticket.assigned')
    async onTicketAssigned(payload: { ticket: any; assignedUserId: string }) {
        if (!payload?.assignedUserId || !payload?.ticket) return;
        await this.create({
            userId: payload.assignedUserId,
            companyId: payload.ticket.companyId,
            type: 'ticket.assigned',
            title: 'Ticket atribuído a você',
            body: payload.ticket.subject || `Ticket #${payload.ticket.id.slice(0, 8)}`,
            entityType: 'ticket',
            entityId: payload.ticket.id,
        }).catch(err => this.logger.error('Erro ao criar notificação ticket.assigned:', err.message));
    }

    @OnEvent('ticket.mention')
    async onTicketMention(payload: { userId: string; companyId: string; ticketId: string; mentionContent: string }) {
        if (!payload?.userId) return;
        await this.create({
            userId: payload.userId,
            companyId: payload.companyId,
            type: 'ticket.mention',
            title: 'Você foi mencionado em um ticket',
            body: payload.mentionContent?.slice(0, 100),
            entityType: 'ticket',
            entityId: payload.ticketId,
        }).catch(err => this.logger.error('Erro ao criar notificação ticket.mention:', err.message));
    }

    @OnEvent('sla.breach')
    async onSlaBreach(payload: { ticketId: string; companyId: string; assignedUserId?: string; departmentName?: string }) {
        if (!payload?.assignedUserId) return;
        await this.create({
            userId: payload.assignedUserId,
            companyId: payload.companyId,
            type: 'sla.breach',
            title: 'SLA violado!',
            body: `Um ticket ${payload.departmentName ? 'em ' + payload.departmentName : ''} violou o SLA.`,
            entityType: 'ticket',
            entityId: payload.ticketId,
        }).catch(err => this.logger.error('Erro ao criar notificação sla.breach:', err.message));
    }
}
