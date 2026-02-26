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
    // Reseta ao reiniciar (deduplicação de curto prazo é suficiente)
    private readonly breachNotifiedAt = new Map<string, number>();
    private readonly BREACH_NOTIFY_COOLDOWN_MS = 30 * 60 * 1000; // 30 min entre notificações do mesmo ticket

    constructor(
        private readonly prisma: PrismaService,
        private readonly eventEmitter: EventEmitter2,
        @InjectQueue('tickets-monitor') private readonly monitorQueue: Queue,
    ) {
        super();
    }

    async onModuleInit() {
        // Registrar o job repetível para rodar a cada 5 minutos
        await this.monitorQueue.add(
            'check-sla',
            {},
            {
                repeat: {
                    every: 5 * 60 * 1000, // 5 minutos
                },
                jobId: 'sla-breach-monitor',
                removeOnComplete: true,
            },
        );
        this.logger.log('SLA Monitor Job registrado (5 min interval)');
    }

    async process(job: Job): Promise<any> {
        if (job.name === 'check-sla') {
            return this.handleSlaCheck();
        }
    }

    private async handleSlaCheck() {
        this.logger.log('Iniciando verificação de SLA para todos os tickets abertos...');

        const openTickets = await this.prisma.ticket.findMany({
            where: {
                status: {
                    in: [TicketStatus.OPEN, TicketStatus.PENDING, TicketStatus.PAUSED]
                },
                department: {
                    OR: [
                        { slaFirstResponseMin: { not: null } },
                        { slaResolutionMin: { not: null } }
                    ]
                }
            },
            include: {
                department: true
            }
        });

        const now = new Date();
        let breachCount = 0;

        for (const ticket of openTickets) {
            const department = ticket.department;
            if (!department) continue;

            let isBreached = false;
            let breachType: 'FIRST_RESPONSE' | 'RESOLUTION' | null = null;

            // Verificação de Primeira Resposta
            if (department.slaFirstResponseMin && !ticket.firstResponseAt) {
                const limitDate = new Date(ticket.createdAt.getTime() + (department.slaFirstResponseMin * 60 * 1000));
                if (now > limitDate) {
                    isBreached = true;
                    breachType = 'FIRST_RESPONSE';
                }
            }

            // Verificação de Resolução
            if (!isBreached && department.slaResolutionMin && !ticket.resolvedAt) {
                const limitDate = new Date(ticket.createdAt.getTime() + (department.slaResolutionMin * 60 * 1000));
                if (now > limitDate) {
                    isBreached = true;
                    breachType = 'RESOLUTION';
                }
            }

            if (isBreached && breachType) {
                breachCount++;

                // Deduplicação: não notificar o mesmo ticket+tipo dentro do cooldown
                const cacheKey = `${ticket.id}:${breachType}`;
                const lastNotified = this.breachNotifiedAt.get(cacheKey) ?? 0;
                const shouldNotify = Date.now() - lastNotified > this.BREACH_NOTIFY_COOLDOWN_MS;

                if (shouldNotify) {
                    this.breachNotifiedAt.set(cacheKey, Date.now());

                    // Emitir evento de violação de SLA
                    this.eventEmitter.emit('sla.breach', {
                        ticketId: ticket.id,
                        companyId: ticket.companyId,
                        assignedUserId: ticket.assignedUserId,
                        departmentName: department.name,
                        breachType,
                        ticket
                    });

                    this.logger.warn(
                        `SLA breach detectado: ticket=${ticket.id} type=${breachType} empresa=${ticket.companyId}`
                    );
                }
            }
        }

        this.logger.log(`Verificação de SLA concluída. ${breachCount} violações detectadas.`);
        return { checked: openTickets.length, breached: breachCount };
    }
}
