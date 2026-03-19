import { Controller, Post, Body, Logger, HttpCode } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { WebhookProcessingService } from './webhook-processing.service';
import { ZApiWebhookPayload } from './dto/zapi-webhook.dto';

/**
 * Rate limiting para webhooks Z-API:
 * - 100 requisições por minuto por IP
 */
const WEBHOOK_THROTTLE_LIMIT = 100;
const WEBHOOK_THROTTLE_TTL = 60000; // 1 minuto

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
    private readonly logger = new Logger(WebhooksController.name);

    constructor(
        private readonly processingService: WebhookProcessingService,
        @InjectQueue('webhooks-incoming') private readonly webhooksQueue: Queue,
    ) { }

    /**
     * Endpoint principal de webhook da Z-API.
     *
     * @Public() — obrigatório: a Z-API não envia JWT, é uma chamada externa.
     *
     * O endpoint valida o token de segurança e enfileira o payload no BullMQ
     * para processamento assíncrono, retornando 202 imediatamente.
     * Isso evita que picos de mensagens bloqueiem o Event Loop e causem
     * retentativas em cascata (Retry Storm) na Z-API.
     */
    @Post('zapi')
    @Public()
    @HttpCode(202)
    @Throttle({ default: { limit: WEBHOOK_THROTTLE_LIMIT, ttl: WEBHOOK_THROTTLE_TTL } })
    @ApiOperation({ summary: 'Webhook para receber eventos da Z-API' })
    async handleZApiWebhook(@Body() payload: ZApiWebhookPayload) {
        try {
            const type: string = payload.type || '';
            const instanceId: string = payload.instanceId || '';

            this.logger.log(`[WEBHOOK] tipo=${type || '(sem type)'} instanceId=${instanceId || '(vazio)'} fromMe=${payload.fromMe} phone=${payload.phone || '-'}`);

            // Validar token de segurança de forma síncrona — antes de enfileirar.
            // Em produção, instanceId vazio é suspeito e deve ser rejeitado.
            if (!instanceId && process.env.NODE_ENV === 'production') {
                this.logger.warn('[WEBHOOK] Rejeitado: instanceId ausente em produção');
                return { success: false, error: 'instanceId obrigatório' };
            }

            if (instanceId) {
                const isValid = await this.processingService.validateZApiToken(instanceId, payload.clientToken);
                if (!isValid) {
                    this.logger.warn(`[WEBHOOK] Rejeitado por token inválido: instanceId=${instanceId}`);
                    return { success: false, error: 'Token de segurança inválido' };
                }
            }

            // Ignorar DeliveryCallback (apenas confirmação de envio, sem processamento necessário)
            if (type === 'DeliveryCallback') {
                this.logger.debug(`Delivery confirmado: ${payload.messageId}`);
                return { queued: false, reason: 'delivery_ack_only' };
            }

            // Enfileirar para processamento assíncrono
            await this.webhooksQueue.add('process', { type, payload });

            return { queued: true };
        } catch (error) {
            this.logger.error(`Erro ao enfileirar webhook: ${error.message}`, error.stack);
            return { success: false, error: error.message };
        }
    }
}
