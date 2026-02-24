import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Processa jobs da fila 'scheduling'.
 * Job 'send-reminder': enviado por SchedulingService.scheduleReminder() 1h antes do agendamento.
 */
@Processor('scheduling')
export class SchedulingProcessor extends WorkerHost {
    private readonly logger = new Logger(SchedulingProcessor.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly eventEmitter: EventEmitter2,
    ) {
        super();
    }

    async process(job: Job): Promise<any> {
        if (job.name === 'send-reminder') {
            return this.handleSendReminder(job.data);
        }
        this.logger.warn(`Job desconhecido na fila scheduling: ${job.name}`);
    }

    private async handleSendReminder(data: { scheduleId: string }) {
        this.logger.log(`Processando lembrete para agendamento: ${data.scheduleId}`);

        const schedule = await this.prisma.schedule.findUnique({
            where: { id: data.scheduleId },
            include: {
                contact: true,
                user: true,
            },
        });

        if (!schedule) {
            this.logger.warn(`Agendamento não encontrado: ${data.scheduleId}`);
            return;
        }

        if (schedule.status === 'CANCELLED' || schedule.status === 'FINISHED') {
            this.logger.log(`Agendamento ${data.scheduleId} já está ${schedule.status} — lembrete ignorado`);
            return;
        }

        // Emite evento para o sistema (pode ser capturado por Workflows ou NotificationsService)
        this.eventEmitter.emit('schedule.reminder', {
            scheduleId: schedule.id,
            companyId: schedule.companyId,
            userId: schedule.userId,
            contactId: schedule.contactId,
            startTime: schedule.startTime,
            contact: schedule.contact,
            assignedUserId: schedule.userId,
        });

        this.logger.log(
            `Lembrete emitido: agendamento=${schedule.id} para contato=${schedule.contact?.name} em ${schedule.startTime.toISOString()}`
        );

        return { success: true, scheduleId: schedule.id };
    }
}
