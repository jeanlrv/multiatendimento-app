import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WebhookProcessingService } from './webhook-processing.service';

@Processor('webhooks-incoming')
export class WebhookProcessor extends WorkerHost {
    private readonly logger = new Logger(WebhookProcessor.name);

    constructor(private readonly processingService: WebhookProcessingService) {
        super();
    }

    async process(job: Job): Promise<void> {
        const { type, payload } = job.data as { type: string; payload: any };

        this.logger.debug(`[WEBHOOK-PROCESSOR] Processando job ${job.id} tipo=${type}`);

        switch (type) {
            case 'MessageCallback':
            case 'ReceivedCallback':
                await this.processingService.processIncomingMessage(payload);
                break;

            case 'MessageStatusCallback':
                await this.processingService.processMessageStatus(payload);
                break;

            case 'PresenceChatCallback':
                await this.processingService.processPresenceUpdate(payload);
                break;

            case 'ConnectedCallback':
                await this.processingService.processInstanceStatus(payload, 'CONNECTED');
                break;

            case 'DisconnectedCallback':
                await this.processingService.processInstanceStatus(payload, 'DISCONNECTED');
                break;

            default:
                if (payload.phone && payload.fromMe === false) {
                    await this.processingService.processIncomingMessage(payload);
                } else {
                    this.logger.debug(`Webhook com tipo desconhecido: ${type}`);
                }
        }
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, error: Error) {
        this.logger.error(
            `[WEBHOOK-PROCESSOR] Job ${job.id} (tipo=${job.data?.type}) falhou após ${job.attemptsMade} tentativa(s): ${error.message}`,
            error.stack,
        );
    }
}
