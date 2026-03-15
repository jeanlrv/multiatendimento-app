import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TicketStatus } from '@prisma/client';

@Injectable()
@Processor('tickets-monitor')
export class SlaMonitorService extends WorkerHost implements OnModuleInit {
    private readonly logger = new Logger(SlaMonitorService.name);

    // Cache em memória para evitar spam de notificações: `${ticketId}:${breachType}` → timestamp
    private readonly breachNotifiedAt = new Map<string, number>();
    private readonly BREACH_NOTIFY_COOLDOWN_MS = 30 * 60 * 1000; // 30 min

    constructor(
        private readonly prisma: PrismaService,
        private readonly eventEmitter: EventEmitter2,
        @InjectQueue('tickets-monitor') private readonly monitorQueue: Queue,
    ) {
        super();
    }

    async onModuleInit() {
        await this.monitorQueue.add(
            'check-sla',
            {},
            {
                repeat: { every: 5 * 60 * 1000 },
                jobId: 'sla-breach-monitor',
                removeOnComplete: true,
            },
        );
        await this.monitorQueue.add(
            'check-expiration',
            {},
            {
                repeat: { every: 5 * 60 * 1000 },
                jobId: 'ticket-expiration-monitor',
                removeOnComplete: true,
            },
        );
        this.logger.log('SLA + Expiration Monitor Jobs registrados (5 min interval)');
    }

    async process(job: Job): Promise<any> {
        if (job.name === 'check-sla') return this.handleSlaCheck();
        if (job.name === 'check-expiration') return this.handleExpiration();
    }

    // ─── SLA breach ────────────────────────────────────────────────────────────

    private async handleSlaCheck() {
        this.logger.log('Iniciando verificação de SLA...');

        const openTickets = await this.prisma.ticket.findMany({
            where: {
                status: { in: [TicketStatus.OPEN, TicketStatus.PENDING, TicketStatus.PAUSED] },
                department: {
                    OR: [
                        { slaFirstResponseMin: { not: null } },
                        { slaResolutionMin: { not: null } },
                    ],
                },
            },
            include: { department: true },
        });

        const now = new Date();
        let breachCount = 0;

        for (const ticket of openTickets) {
            const department = ticket.department;
            if (!department) continue;

            let isBreached = false;
            let breachType: 'FIRST_RESPONSE' | 'RESOLUTION' | null = null;

            if (department.slaFirstResponseMin && !ticket.firstResponseAt) {
                const limitDate = new Date(ticket.createdAt.getTime() + department.slaFirstResponseMin * 60_000);
                if (now > limitDate) { isBreached = true; breachType = 'FIRST_RESPONSE'; }
            }

            if (!isBreached && department.slaResolutionMin && !ticket.resolvedAt) {
                const limitDate = new Date(ticket.createdAt.getTime() + department.slaResolutionMin * 60_000);
                if (now > limitDate) { isBreached = true; breachType = 'RESOLUTION'; }
            }

            if (isBreached && breachType) {
                breachCount++;
                const cacheKey = `${ticket.id}:${breachType}`;
                const lastNotified = this.breachNotifiedAt.get(cacheKey) ?? 0;
                if (Date.now() - lastNotified > this.BREACH_NOTIFY_COOLDOWN_MS) {
                    this.breachNotifiedAt.set(cacheKey, Date.now());
                    this.eventEmitter.emit('sla.breach', {
                        ticketId: ticket.id,
                        companyId: ticket.companyId,
                        assignedUserId: ticket.assignedUserId,
                        departmentName: department.name,
                        breachType,
                        ticket,
                    });
                    this.logger.warn(`SLA breach: ticket=${ticket.id} type=${breachType} empresa=${ticket.companyId}`);
                }
            }
        }

        this.logger.log(`SLA concluído. ${breachCount} violações.`);
        return { checked: openTickets.length, breached: breachCount };
    }

    // ─── Ticket expiration + CSAT expiration ───────────────────────────────────

    private async handleExpiration() {
        await Promise.all([
            this.handleTicketExpiration(),
            this.handleCsatExpiration(),
        ]);
    }

    private async handleTicketExpiration() {
        const settings = await this.prisma.setting.findMany({
            where: { key: 'ticketExpirationMinutes' },
            select: { companyId: true, value: true },
        });

        let totalExpired = 0;

        for (const s of settings) {
            let minutes: number;
            try { minutes = parseInt(JSON.parse(String(s.value)), 10); } catch { continue; }
            if (!minutes || minutes <= 0) continue;

            const cutoff = new Date(Date.now() - minutes * 60_000);

            const expired = await this.prisma.ticket.findMany({
                where: {
                    companyId: s.companyId,
                    status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING] },
                    lastMessageAt: { lt: cutoff },
                },
                select: {
                    id: true,
                    companyId: true,
                    connectionId: true,
                    contact: { select: { phoneNumber: true } },
                },
            });

            if (expired.length === 0) continue;

            await this.prisma.ticket.updateMany({
                where: { id: { in: expired.map(t => t.id) } },
                data: { status: TicketStatus.RESOLVED, closedAt: new Date(), resolvedAt: new Date() },
            });

            // Buscar mensagem de expiração (opcional)
            const msgSetting = await this.prisma.setting.findFirst({
                where: { companyId: s.companyId, key: 'expiredTicketMessage' },
                select: { value: true },
            });
            let expMsg: string | null = null;
            if (msgSetting?.value) {
                const raw = String(msgSetting.value);
                try { expMsg = JSON.parse(raw); } catch { expMsg = raw.replace(/^"|"$/g, ''); }
            }

            for (const ticket of expired) {
                this.eventEmitter.emit('ticket.status_changed', {
                    ticketId: ticket.id,
                    companyId: ticket.companyId,
                    newStatus: TicketStatus.RESOLVED,
                });
                if (expMsg && ticket.connectionId && ticket.contact?.phoneNumber) {
                    this.eventEmitter.emit('ticket.expired', {
                        ticketId: ticket.id,
                        companyId: ticket.companyId,
                        connectionId: ticket.connectionId,
                        phoneNumber: ticket.contact.phoneNumber,
                        message: expMsg,
                    });
                }
            }

            totalExpired += expired.length;
            this.logger.log(`[Expiration] ${expired.length} ticket(s) expirados na empresa ${s.companyId}`);
        }

        return totalExpired;
    }

    private async handleCsatExpiration() {
        const settings = await this.prisma.setting.findMany({
            where: { key: 'evaluationExpirationMinutes' },
            select: { companyId: true, value: true },
        });

        for (const s of settings) {
            let minutes: number;
            try { minutes = parseInt(JSON.parse(String(s.value)), 10); } catch { continue; }
            if (!minutes || minutes <= 0) continue;

            const cutoff = new Date(Date.now() - minutes * 60_000);

            const expiredTickets = await this.prisma.ticket.findMany({
                where: { companyId: s.companyId, resolvedAt: { lt: cutoff } },
                select: { id: true },
            });
            if (expiredTickets.length === 0) continue;

            const { count } = await this.prisma.contact.updateMany({
                where: {
                    companyId: s.companyId,
                    csatPending: true,
                    csatTicketId: { in: expiredTickets.map(t => t.id) },
                },
                data: { csatPending: false, csatTicketId: null },
            });

            if (count > 0)
                this.logger.log(`[CsatExpiration] ${count} CSAT(s) expirados na empresa ${s.companyId}`);
        }
    }
}
