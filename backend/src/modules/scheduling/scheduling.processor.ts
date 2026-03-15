import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
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
        if (job.name === 'send-scheduled-message') {
            return this.handleSendScheduledMessage(job.data);
        }
        this.logger.warn(`Job desconhecido na fila scheduling: ${job.name}`);
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, err: Error) {
        this.logger.error({
            event: 'job_failed',
            queue: 'scheduling',
            jobId: job.id,
            jobName: job.name,
            error: err.message,
            attempts: job.attemptsMade,
            data: { scheduleId: job.data?.scheduleId ?? job.data?.scheduledMessageId },
        });
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

    private async handleSendScheduledMessage(data: { scheduledMessageId: string; ticketId: string; companyId: string }) {
        this.logger.log(`Enviando mensagem agendada: ${data.scheduledMessageId}`);

        const msg = await this.prisma.scheduledMessage.findUnique({ where: { id: data.scheduledMessageId } });
        if (!msg || msg.status !== 'PENDING') {
            this.logger.log(`Mensagem agendada ${data.scheduledMessageId} não está mais pendente — ignorando`);
            return;
        }

        this.eventEmitter.emit('scheduled_message.fire', {
            ticketId: data.ticketId,
            content: msg.content,
            companyId: data.companyId,
            scheduledMessageId: msg.id,
        });

        await this.prisma.scheduledMessage.update({
            where: { id: data.scheduledMessageId },
            data: { status: 'SENT' },
        });

        this.logger.log(`Mensagem agendada ${data.scheduledMessageId} marcada como enviada`);
        return { success: true };
    }
}
