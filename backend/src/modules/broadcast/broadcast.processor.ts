import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { forwardRef, Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BroadcastService } from './broadcast.service';

@Processor('broadcast')
export class BroadcastProcessor extends WorkerHost {
    private readonly logger = new Logger(BroadcastProcessor.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly whatsappService: WhatsAppService,
        private readonly eventEmitter: EventEmitter2,
        @Inject(forwardRef(() => BroadcastService))
        private readonly broadcastService: BroadcastService,
    ) {
        super();
    }

    async process(job: Job): Promise<any> {
        if (job.name === 'send-broadcast-message') {
            return this.handleSendBroadcastMessage(job.data);
        }
        if (job.name === 'start-scheduled-broadcast') {
            const { broadcastId, companyId } = job.data;
            this.logger.log(`Disparando broadcast agendado ${broadcastId}`);
            return this.broadcastService.start(companyId, broadcastId);
        }
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, err: Error) {
        this.logger.error({
            event: 'job_failed',
            queue: 'broadcast',
            jobId: job.id,
            jobName: job.name,
            error: err.message,
            attempts: job.attemptsMade,
            data: { broadcastId: job.data?.broadcastId, companyId: job.data?.companyId },
        });
    }

    private async handleSendBroadcastMessage(data: {
        broadcastId: string;
        recipientId: string;
        contactId: string;
        phoneNumber: string;
        contactName: string;
        contactPhone?: string;
        contactCompany?: string;
        lastTicketId?: string;
        message: string;
        connectionId?: string;
        companyId: string;
    }) {
        // Check if broadcast is still RUNNING
        const broadcast = await this.prisma.broadcast.findUnique({ where: { id: data.broadcastId } });
        if (!broadcast || broadcast.status !== 'RUNNING') {
            this.logger.log(`Broadcast ${data.broadcastId} não está em execução — pulando`);
            return;
        }

        const protocol = data.lastTicketId ? data.lastTicketId.slice(-6).toUpperCase() : '';
        const vars: Record<string, string> = {
            nome: data.contactName || 'Cliente',
            telefone: data.contactPhone || data.phoneNumber || '',
            empresa: data.contactCompany || '',
            protocolo: protocol,
        };
        const personalizedMessage = data.message.replace(
            /\{\{(\w+)\}\}/g,
            (_, key) => vars[key.toLowerCase()] ?? `{{${key}}}`,
        );

        let success = false;
        let errorMsg = '';

        try {
            if (data.connectionId) {
                await this.whatsappService.sendMessage(data.connectionId, data.phoneNumber, personalizedMessage, data.companyId);
            }
            success = true;
        } catch (err) {
            errorMsg = err?.message || 'Erro desconhecido';
            this.logger.error(`Broadcast ${data.broadcastId}: erro ao enviar para ${data.phoneNumber}: ${errorMsg}`);
        }

        await this.prisma.broadcastRecipient.update({
            where: { id: data.recipientId },
            data: {
                status: success ? 'SENT' : 'FAILED',
                sentAt: success ? new Date() : undefined,
                error: success ? undefined : errorMsg,
            },
        });

        // Update broadcast counters
        const updateField = success ? { sentCount: { increment: 1 } } : { failedCount: { increment: 1 } };
        const updated = await this.prisma.broadcast.update({
            where: { id: data.broadcastId },
            data: updateField,
        });

        // Check if all done
        const total = updated.totalContacts;
        const done = updated.sentCount + updated.failedCount;
        if (done >= total) {
            await this.prisma.broadcast.update({ where: { id: data.broadcastId }, data: { status: 'COMPLETED' } });
            this.logger.log(`Broadcast ${data.broadcastId} concluído: ${updated.sentCount} enviados, ${updated.failedCount} falhas`);
        }

        // Emit real-time progress via EventEmitter (ChatGateway listens to this)
        this.eventEmitter.emit('broadcast.progress', {
            companyId: data.companyId,
            broadcastId: data.broadcastId,
            sentCount: updated.sentCount,
            failedCount: updated.failedCount,
            totalContacts: updated.totalContacts,
            status: done >= total ? 'COMPLETED' : 'RUNNING',
        });

        return { success };
    }
}
