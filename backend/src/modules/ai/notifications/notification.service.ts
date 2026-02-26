import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job, QueueEvents } from 'bullmq';
import type { PrismaService } from '../../../database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

/**
 * Serviço de notificações via WebSocket para eventos do sistema.
 * Notifica clientes sobre eventos como conclusão de processamento de documentos.
 */
@Injectable()
export class NotificationService implements OnModuleInit {
    private readonly logger = new Logger(NotificationService.name);

    private queueEvents: QueueEvents;
    private pendingNotifications = new Map<string, any[]>();

    constructor(
        private prisma: PrismaService,
        private eventEmitter: EventEmitter2,
        private configService: ConfigService,
        @InjectQueue('knowledge-processing') private knowledgeQueue: Queue,
    ) { }

    async onModuleInit() {
        this.logger.log('NotificationService inicializado');

        // Configurar listener para eventos da fila
        const redisOptions = {
            host: this.configService.get<string>('REDIS_HOST', 'localhost'),
            port: this.configService.get<number>('REDIS_PORT', 6379),
        };

        this.queueEvents = new QueueEvents('knowledge-processing', { connection: redisOptions });

        // Escutar eventos de conclusão de processamento
        this.queueEvents.on('completed', ({ jobId }: { jobId: string }) => this.handleJobCompleted(jobId));
        this.queueEvents.on('failed', ({ jobId, failedReason }: { jobId: string; failedReason: string }) => this.handleJobFailed(jobId, failedReason));
        this.queueEvents.on('progress', ({ jobId, data }: { jobId: string; data: any }) => this.handleJobProgress(jobId, data));
    }

    private async handleJobProgress(jobId: string, progress: any) {
        // Buscar detalhes do job para obter companyId
        const job = await this.knowledgeQueue.getJob(jobId);
        if (job && job.name === 'process-document') {
            const { documentId, companyId } = job.data as { documentId: string; companyId: string };

            this.logger.log(`Documento em processamento: ${documentId} - Progresso: ${progress}`);

            // Emitir evento de progresso
            this.eventEmitter.emit('document.progress', {
                documentId,
                companyId,
                progress,
                timestamp: new Date(),
            });
        }
    }

    /**
     * Lidar com conclusão bem-sucedida de job
     */
    private async handleJobCompleted(jobId: string) {
        const job = await this.knowledgeQueue.getJob(jobId);
        if (job && job.name === 'process-document') {
            const { documentId, companyId } = job.data as { documentId: string; companyId: string };

            this.logger.log(`Documento processado com sucesso: ${documentId}`);

            // Emitir evento via EventEmitter2
            this.eventEmitter.emit('document.processed', {
                documentId,
                companyId,
                timestamp: new Date(),
            });

            // Notificar via WebSocket
            await this.notifyUser(companyId, 'document_processed', {
                documentId,
                message: 'Documento processado com sucesso',
            });
        }
    }

    /**
     * Lidar com falha no job
     */
    private async handleJobFailed(jobId: string, error: string) {
        const job = await this.knowledgeQueue.getJob(jobId);
        if (job && job.name === 'process-document') {
            const { documentId, companyId } = job.data as { documentId: string; companyId: string };

            this.logger.error(`Documento falhou no processamento: ${documentId} - ${error}`);

            // Emitir evento via EventEmitter2
            this.eventEmitter.emit('document.failed', {
                documentId,
                companyId,
                error,
                timestamp: new Date(),
            });

            // Notificar via WebSocket
            await this.notifyUser(companyId, 'document_failed', {
                documentId,
                message: 'Erro ao processar documento',
                error,
            });
        }
    }

    /**
     * Notifica um usuário sobre um evento
     */
    private async notifyUser(companyId: string, event: string, data: any) {
        // Adicionar à fila de notificações pendentes
        const key = `${companyId}`;
        if (!this.pendingNotifications.has(key)) {
            this.pendingNotifications.set(key, []);
        }

        const notifications = this.pendingNotifications.get(key)!;
        notifications.push({ event, data, timestamp: new Date() });

        // Limitar tamanho da fila
        if (notifications.length > 100) {
            notifications.shift();
        }

        // Em produção, isso seria enviado via WebSocket
        // Para agora, apenas logamos
        this.logger.log(`Notificação enviada para empresa ${companyId}: ${event}`);
    }

    /**
     * Obtém notificações pendentes de um usuário
     */
    async getPendingNotifications(companyId: string) {
        const key = `${companyId}`;
        const notifications = this.pendingNotifications.get(key) || [];

        // Limpar notificações após leitura
        this.pendingNotifications.delete(key);

        return notifications;
    }

    /**
     * Limpa todas as notificações pendentes
     */
    clearNotifications(companyId: string) {
        const key = `${companyId}`;
        this.pendingNotifications.delete(key);
    }

    /**
     * Registra um evento customizado
     */
    async emitEvent(event: string, data: any) {
        this.eventEmitter.emit(event, data);
    }

    /**
     * Obtém estatísticas de notificações
     */
    async getNotificationStats(companyId: string) {
        const processed = await (this.prisma as any).notification.count({
            where: { companyId },
        });

        const unread = await (this.prisma as any).notification.count({
            where: {
                companyId,
                readAt: null,
            },
        });

        return {
            total: processed,
            unread,
        };
    }
}