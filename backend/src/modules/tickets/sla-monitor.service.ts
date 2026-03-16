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

    // ─── SLA breach with proactive thresholds ──────────────────────────────────

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

            // Calcular % de consumo do SLA
            let slaPercent = 0;
            let breachType: 'FIRST_RESPONSE' | 'RESOLUTION' | null = null;
            let slaLimitMs = 0;

            if (department.slaFirstResponseMin && !ticket.firstResponseAt) {
                slaLimitMs = department.slaFirstResponseMin * 60_000;
                const elapsed = now.getTime() - ticket.createdAt.getTime();
                slaPercent = (elapsed / slaLimitMs) * 100;
                breachType = 'FIRST_RESPONSE';
            } else if (department.slaResolutionMin && !ticket.resolvedAt) {
                slaLimitMs = department.slaResolutionMin * 60_000;
                const elapsed = now.getTime() - ticket.createdAt.getTime();
                slaPercent = (elapsed / slaLimitMs) * 100;
                breachType = 'RESOLUTION';
            }

            if (!breachType || slaPercent < 75) continue;

            const cacheKey = `${ticket.id}:${breachType}`;
            const lastNotified = this.breachNotifiedAt.get(cacheKey) ?? 0;
            const cooldownMs = slaPercent >= 100 ? this.BREACH_NOTIFY_COOLDOWN_MS : 10 * 60 * 1000; // 10min para warnings

            if (Date.now() - lastNotified <= cooldownMs) continue;
            this.breachNotifiedAt.set(cacheKey, Date.now());

            if (slaPercent >= 100) {
                // 🔴 100% — Viola + Redistribuir para outro atendente com menor carga
                breachCount++;
                this.eventEmitter.emit('sla.breach', {
                    ticketId: ticket.id,
                    companyId: ticket.companyId,
                    assignedUserId: ticket.assignedUserId,
                    departmentName: department.name,
                    breachType,
                    ticket,
                });

                // Redistribuir para atendente com menor carga
                await this.redistributeTicket(ticket);
                this.logger.warn(`SLA breach 100%: ticket=${ticket.id} type=${breachType} — redistribuído`);

            } else if (slaPercent >= 90) {
                // 🟠 90% — Alerta supervisor + escalar prioridade
                if (ticket.priority !== 'CRITICAL' && ticket.priority !== 'HIGH') {
                    await this.prisma.ticket.update({
                        where: { id: ticket.id },
                        data: { priority: 'HIGH' },
                    });
                }
                // Notificar supervisores
                this.eventEmitter.emit('sla.warning', {
                    ticketId: ticket.id,
                    companyId: ticket.companyId,
                    assignedUserId: ticket.assignedUserId,
                    departmentName: department.name,
                    level: '90%',
                    breachType,
                });
                this.logger.warn(`SLA warning 90%: ticket=${ticket.id} prioridade escalada para HIGH`);

            } else {
                // 🟡 75% — Alerta ao atendente
                this.eventEmitter.emit('sla.warning', {
                    ticketId: ticket.id,
                    companyId: ticket.companyId,
                    assignedUserId: ticket.assignedUserId,
                    departmentName: department.name,
                    level: '75%',
                    breachType,
                });
                this.logger.log(`SLA warning 75%: ticket=${ticket.id}`);
            }
        }

        this.logger.log(`SLA concluído. ${breachCount} violações.`);
        return { checked: openTickets.length, breached: breachCount };
    }

    /**
     * Redistribui ticket para o atendente do departamento com menor carga.
     */
    private async redistributeTicket(ticket: any) {
        try {
            const agents = await this.prisma.user.findMany({
                where: {
                    companyId: ticket.companyId,
                    departments: { some: { id: ticket.departmentId } },
                    isActive: true,
                    id: { not: ticket.assignedUserId || undefined }, // exclui atendente atual
                },
                select: {
                    id: true,
                    name: true,
                    _count: {
                        select: {
                            assignedTickets: {
                                where: { status: { in: [TicketStatus.OPEN, TicketStatus.PENDING, TicketStatus.IN_PROGRESS] } }
                            }
                        }
                    }
                },
                orderBy: { assignedTickets: { _count: 'asc' } },
            });

            if (agents.length === 0) {
                this.logger.warn(`[Redistribuir] Nenhum agente disponível para ticket ${ticket.id}`);
                return;
            }

            const bestAgent = agents[0];
            await this.prisma.ticket.update({
                where: { id: ticket.id },
                data: { assignedUserId: bestAgent.id },
            });

            this.eventEmitter.emit('ticket.assigned', {
                ticket,
                assignedUserId: bestAgent.id,
            });

            this.logger.log(`[Redistribuir] ticket=${ticket.id} → agente ${bestAgent.name} (${bestAgent._count.assignedTickets} tickets)`);
        } catch (err) {
            this.logger.error(`[Redistribuir] Falha: ${(err as any).message}`);
        }
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
