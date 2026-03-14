import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import * as webpush from 'web-push';

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
    ) {
        const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
        const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
        const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@kszap.com';

        if (vapidPublicKey && vapidPrivateKey) {
            webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
            this.logger.log('Web Push (VAPID) configurado.');
        } else {
            this.logger.warn('VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY não definidas — Web Push desabilitado.');
        }
    }

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

    async saveSubscription(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
        await this.prisma.pushSubscription.upsert({
            where: { endpoint: subscription.endpoint },
            create: { userId, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
            update: { userId },
        });
    }

    async deleteSubscription(endpoint: string) {
        await this.prisma.pushSubscription.deleteMany({ where: { endpoint } }).catch(() => null);
    }

    async sendWebPush(userId: string, title: string, body: string, url?: string) {
        if (!process.env.VAPID_PUBLIC_KEY) return;

        const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
        await Promise.all(subs.map(async (sub) => {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    JSON.stringify({ title, body, url: url ?? '/dashboard/tickets' }),
                );
            } catch (err: any) {
                // 410 Gone = subscription inválida (browser desinstalado)
                if (err.statusCode === 410) {
                    await this.prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } }).catch(() => null);
                } else {
                    this.logger.warn(`Falha ao enviar Web Push para ${sub.userId}: ${err.message}`);
                }
            }
        }));
    }

    // ─── Event Listeners ──────────────────────────────────────────────────────

    @OnEvent('ticket.assigned')
    async onTicketAssigned(payload: { ticket: any; assignedUserId: string }) {
        if (!payload?.assignedUserId || !payload?.ticket) return;
        const notification = await this.create({
            userId: payload.assignedUserId,
            companyId: payload.ticket.companyId,
            type: 'ticket.assigned',
            title: 'Ticket atribuído a você',
            body: payload.ticket.subject || `Ticket #${payload.ticket.id.slice(0, 8)}`,
            entityType: 'ticket',
            entityId: payload.ticket.id,
        }).catch(err => { this.logger.error('Erro ao criar notificação ticket.assigned:', err.message); return null; });

        if (notification) {
            await this.sendWebPush(
                payload.assignedUserId,
                notification.title,
                notification.body ?? '',
                `/dashboard/tickets?id=${payload.ticket.id}`,
            );
        }
    }

    @OnEvent('ticket.mention')
    async onTicketMention(payload: { userId: string; companyId: string; ticketId: string; mentionContent: string }) {
        if (!payload?.userId) return;
        const notification = await this.create({
            userId: payload.userId,
            companyId: payload.companyId,
            type: 'ticket.mention',
            title: 'Você foi mencionado em um ticket',
            body: payload.mentionContent?.slice(0, 100),
            entityType: 'ticket',
            entityId: payload.ticketId,
        }).catch(err => { this.logger.error('Erro ao criar notificação ticket.mention:', err.message); return null; });

        if (notification) {
            await this.sendWebPush(
                payload.userId,
                notification.title,
                notification.body ?? '',
                `/dashboard/tickets?id=${payload.ticketId}`,
            );
        }
    }

    @OnEvent('sla.breach')
    async onSlaBreach(payload: { ticketId: string; companyId: string; assignedUserId?: string; departmentName?: string }) {
        if (!payload?.assignedUserId) return;
        const notification = await this.create({
            userId: payload.assignedUserId,
            companyId: payload.companyId,
            type: 'sla.breach',
            title: 'SLA violado!',
            body: `Um ticket ${payload.departmentName ? 'em ' + payload.departmentName : ''} violou o SLA.`,
            entityType: 'ticket',
            entityId: payload.ticketId,
        }).catch(err => { this.logger.error('Erro ao criar notificação sla.breach:', err.message); return null; });

        if (notification) {
            await this.sendWebPush(
                payload.assignedUserId,
                notification.title,
                notification.body ?? '',
                `/dashboard/tickets?id=${payload.ticketId}`,
            );
        }
    }

    @OnEvent('evaluation.negative_score')
    async onNegativeSentiment(payload: { ticketId: string; companyId: string; score: number; threshold: number; summary: string }) {
        const managers = await this.prisma.user.findMany({
            where: {
                companyId: payload.companyId,
                role: { name: { in: ['ADMIN', 'MANAGER', 'admin', 'manager'] } },
            },
            include: { role: true },
        });

        const scoreFormatted = payload.score.toFixed(1);
        await Promise.all(managers.map(async (manager) => {
            const notification = await this.create({
                userId: manager.id,
                companyId: payload.companyId,
                type: 'evaluation.negative_score',
                title: `Avaliação sentimental baixa: ${scoreFormatted}/10`,
                body: `Ticket #${payload.ticketId.slice(-4).toUpperCase()} — ${payload.summary?.substring(0, 120) || 'Score abaixo do limite configurado.'}`,
                entityType: 'ticket',
                entityId: payload.ticketId,
            }).catch(err => { this.logger.error(`Erro ao notificar gestor ${manager.id}:`, err.message); return null; });

            if (notification) {
                await this.sendWebPush(manager.id, notification.title, notification.body ?? '');
            }
        }));
    }
}
