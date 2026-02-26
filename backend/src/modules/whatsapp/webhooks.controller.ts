import { Controller, Post, Body, Logger, Inject, forwardRef, HttpCode, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { ChatService } from '../chat/chat.service';
import { DepartmentsService } from '../departments/departments.service';
import { ChatGateway } from '../chat/chat.gateway';
import { Public } from '../../common/decorators/public.decorator';
import { CryptoService } from '../../common/services/crypto.service';

/**
 * Mapeamento de status Z-API → status interno do sistema.
 * Z-API envia: SENT | RECEIVED | READ | READ_BY_ME | PLAYED
 */
const ZAPI_STATUS_MAP: Record<string, string> = {
    SENT: 'SENT',
    RECEIVED: 'DELIVERED',  // Chegou no telefone do destinatário
    READ: 'READ',
    READ_BY_ME: 'READ',
    PLAYED: 'READ',         // Áudio/vídeo reproduzido
};

/**
 * Rate limiting para webhooks Z-API:
 * - 100 requisições por minuto por IP (padrão)
 * - 10 requisições por segundo para evitar abuse
 */
const WEBHOOK_THROTTLE_LIMIT = 100;
const WEBHOOK_THROTTLE_TTL = 60000; // 1 minuto

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
    private readonly logger = new Logger(WebhooksController.name);

    constructor(
        private prisma: PrismaService,
        private whatsappService: WhatsAppService,
        private departmentsService: DepartmentsService,
        @Inject(forwardRef(() => ChatService)) private chatService: ChatService,
        @Inject(forwardRef(() => ChatGateway)) private chatGateway: ChatGateway,
        private crypto: CryptoService,
    ) { }

    /**
     * Valida o clientToken do webhook Z-API.
     * A Z-API envia o token de segurança no campo `clientToken` do payload.
     * Se a instância tem token configurado e o token não bate, retorna false.
     * Se não tem token configurado, processa (retrocompatível) com aviso de depreciação.
     */
    private async validateZApiToken(instanceId: string, incomingToken?: string): Promise<boolean> {
        const connection = await (this.prisma as any).whatsAppInstance.findUnique({
            where: { zapiInstanceId: instanceId },
        });

        let storedToken: string | null = null;

        if (connection) {
            storedToken = (connection as any).zapiClientToken ?? null;
        } else {
            const integration = await (this.prisma as any).integration.findFirst({
                where: { zapiInstanceId: instanceId, isActive: true },
            });
            storedToken = (integration as any)?.zapiClientToken ?? null;
        }

        // Se token configurado no sistema, validar
        if (storedToken) {
            const decryptedToken = this.crypto.decrypt(storedToken);
            if (incomingToken !== decryptedToken) {
                this.logger.warn(`Webhook Z-API rejeitado: token inválido para instanceId=${instanceId}`);
                return false;
            }
        } else {
            const isProduction = process.env.NODE_ENV === 'production';
            if (isProduction) {
                this.logger.error(
                    `Webhook REJEITADO: instanceId=${instanceId} não possui zapiClientToken configurado. ` +
                    `Configure o token de segurança na integração para habilitar webhooks em produção.`
                );
                return false;
            }
            // Em desenvolvimento aceitar sem token, mas avisar claramente
            this.logger.warn(
                `[DEV ONLY] Webhook aceito sem token para instanceId=${instanceId}. ` +
                `Em produção (NODE_ENV=production) este webhook seria REJEITADO.`
            );
        }

        return true;
    }

    /**
     * Resolve o companyId a partir do instanceId enviado pela Z-API.
     * Busca em WhatsAppInstance e depois em Integration (configuração global).
     */
    private async resolveCompanyId(instanceId: string): Promise<string | null> {
        const connection = await (this.prisma as any).whatsAppInstance.findUnique({
            where: { zapiInstanceId: instanceId },
        });
        if (connection) return connection.companyId;

        const integration = await (this.prisma as any).integration.findFirst({
            where: { zapiInstanceId: instanceId, isActive: true },
        });
        if (integration) return integration.companyId;

        return null;
    }

    /**
     * Extrai o conteúdo e tipo de mídia do payload Z-API.
     * A Z-API envia campos específicos por tipo: text, image, audio, video, document, etc.
     */
    private extractMessageContent(payload: any): {
        messageType: string;
        content: string;
        mediaUrl?: string;
    } {
        if (payload.text?.message) {
            return { messageType: 'TEXT', content: payload.text.message };
        }
        if (payload.image) {
            const url = typeof payload.image === 'string' ? payload.image : (payload.image?.imageUrl || payload.image?.url);
            return { messageType: 'IMAGE', content: payload.image?.caption || '[Imagem]', mediaUrl: url };
        }
        if (payload.audio) {
            const url = typeof payload.audio === 'string' ? payload.audio : (payload.audio?.audioUrl || payload.audio?.url);
            return { messageType: 'AUDIO', content: '[Áudio]', mediaUrl: url };
        }
        if (payload.video) {
            const url = typeof payload.video === 'string' ? payload.video : (payload.video?.videoUrl || payload.video?.url);
            return { messageType: 'VIDEO', content: payload.video?.caption || '[Vídeo]', mediaUrl: url };
        }
        if (payload.document) {
            const url = typeof payload.document === 'string' ? payload.document : (payload.document?.documentUrl || payload.document?.url);
            return { messageType: 'DOCUMENT', content: payload.document?.fileName || '[Documento]', mediaUrl: url };
        }
        if (payload.sticker) {
            const url = typeof payload.sticker === 'string' ? payload.sticker : payload.sticker?.stickerUrl;
            return { messageType: 'STICKER', content: '[Sticker]', mediaUrl: url };
        }
        if (payload.location) {
            const { latitude, longitude } = payload.location;
            return { messageType: 'LOCATION', content: `[Localização: ${latitude}, ${longitude}]` };
        }
        if (payload.contact) {
            return { messageType: 'CONTACT', content: '[Contato compartilhado]' };
        }
        // Resposta a botão ou lista interativa
        if (payload.buttonResponse?.selectedButtonLabel || payload.listResponse?.selectedTitle) {
            const text = payload.buttonResponse?.selectedButtonLabel || payload.listResponse?.selectedTitle;
            return { messageType: 'TEXT', content: text };
        }
        return { messageType: 'TEXT', content: '' };
    }

    /**
     * Endpoint principal de webhook da Z-API.
     *
     * @Public() — obrigatório: a Z-API não envia JWT, é uma chamada externa.
     *
     * A Z-API identifica eventos pelo campo payload.type:
     *   MessageCallback         → mensagem recebida
     *   DeliveryCallback        → confirmação de envio
     *   MessageStatusCallback   → mudança de status (SENT/READ/etc)
     *   PresenceChatCallback    → presença (digitando/disponível)
     *   ConnectedCallback       → instância conectou
     *   DisconnectedCallback    → instância desconectou
     */
    @Post('zapi')
    @Public()
    @HttpCode(200)
    @Throttle({ default: { limit: WEBHOOK_THROTTLE_LIMIT, ttl: WEBHOOK_THROTTLE_TTL } })
    @ApiOperation({ summary: 'Webhook para receber eventos da Z-API' })
    async handleZApiWebhook(@Body() payload: any) {
        try {
            const type: string = payload.type || '';
            const instanceId: string = payload.instanceId || '';

            // Validar token de segurança antes de processar qualquer payload
            if (instanceId) {
                const isValid = await this.validateZApiToken(instanceId, payload.clientToken);
                if (!isValid) {
                    return { success: false, error: 'Token de segurança inválido' };
                }
            }

            switch (type) {
                case 'MessageCallback':
                    await this.handleIncomingMessage(payload);
                    break;

                case 'MessageStatusCallback':
                    await this.handleMessageStatus(payload);
                    break;

                case 'PresenceChatCallback':
                    await this.handlePresenceUpdate(payload);
                    break;

                case 'ConnectedCallback':
                    await this.handleInstanceStatus(payload, 'CONNECTED');
                    break;

                case 'DisconnectedCallback':
                    await this.handleInstanceStatus(payload, 'DISCONNECTED');
                    break;

                case 'DeliveryCallback':
                    this.logger.debug(`Delivery confirmado: ${payload.messageId}`);
                    break;

                default:
                    // Fallback para payloads sem type explícito (compatibilidade)
                    if (payload.phone && payload.fromMe === false) {
                        await this.handleIncomingMessage(payload);
                    } else {
                        this.logger.debug(`Webhook com tipo desconhecido: ${type}`);
                    }
            }

            return { success: true };
        } catch (error) {
            this.logger.error(`Erro ao processar webhook: ${error.message}`, error.stack);
            // Sempre retornar 200 — a Z-API não faz retry em 200
            return { success: false, error: error.message };
        }
    }

    private async handleIncomingMessage(payload: any) {
        // CRÍTICO: ignorar próprias mensagens para evitar loop infinito
        if (payload.fromMe === true) {
            return;
        }

        // Ignorar mensagens de grupos e newsletters
        if (payload.isGroup === true || payload.isNewsletter === true) {
            return;
        }

        const phoneNumber: string = payload.phone;
        const instanceId: string = payload.instanceId;

        if (!phoneNumber || !instanceId) {
            this.logger.warn('Webhook sem phone ou instanceId');
            return;
        }

        const companyId = await this.resolveCompanyId(instanceId);
        if (!companyId) {
            this.logger.warn(`Empresa não encontrada para instanceId: ${instanceId}`);
            return;
        }

        const connection = await (this.prisma as any).whatsAppInstance.findUnique({
            where: { zapiInstanceId: instanceId },
            include: { department: true },
        });

        if (!connection) {
            this.logger.warn(`Conexão não encontrada para instanceId: ${instanceId}`);
            return;
        }

        // Buscar ou criar contato
        let contact = await (this.prisma as any).contact.findFirst({
            where: { phoneNumber, companyId },
        });

        if (!contact) {
            contact = await (this.prisma as any).contact.create({
                data: {
                    phoneNumber,
                    name: payload.senderName || payload.chatName || phoneNumber,
                    profilePicture: payload.senderPhoto || null,
                    company: { connect: { id: companyId } },
                },
            });
        } else if (payload.senderPhoto && contact.profilePicture !== payload.senderPhoto) {
            contact = await (this.prisma as any).contact.update({
                where: { id: contact.id },
                data: {
                    profilePicture: payload.senderPhoto,
                    name: payload.senderName || contact.name,
                },
            });
        }

        // Buscar ticket ativo existente para este contato
        let ticket = await (this.prisma as any).ticket.findFirst({
            where: {
                contactId: contact.id,
                companyId,
                status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] as any },
            },
            include: { department: true },
        });

        // Se não há ticket ativo, criar um
        if (!ticket) {
            const department = connection.department;

            if (!department) {
                this.logger.warn(`Conexão ${connection.id} não possui departamento vinculado`);
                return;
            }

            const { content } = this.extractMessageContent(payload);

            ticket = await (this.prisma as any).ticket.create({
                data: {
                    contact: { connect: { id: contact.id } },
                    department: { connect: { id: department.id } },
                    whatsappInstance: { connect: { id: connection.id } },
                    company: { connect: { id: companyId } },
                    status: 'OPEN' as any,
                    subject: content.substring(0, 100) || 'Novo Atendimento',
                },
                include: { department: true },
            });

            const greeting = department.greetingMessage
                || `Olá! Seu atendimento foi iniciado no setor ${department.name}. Aguarde, em breve alguém irá te ajudar.`;

            await this.whatsappService.sendMessage(connection.id, phoneNumber, greeting, companyId);
            await this.chatService.sendMessage(ticket.id, greeting, true, 'TEXT', undefined, companyId);

            this.logger.log(`Novo ticket criado: ${ticket.id} — Contato: ${phoneNumber}`);
            return; // A primeira mensagem já foi a de boas-vindas; aguardar próxima mensagem do cliente
        }

        // Salvar a mensagem recebida no ticket existente
        const { messageType, content, mediaUrl } = this.extractMessageContent(payload);

        if (!content && !mediaUrl) {
            this.logger.debug(`Mensagem sem conteúdo ignorada: ${payload.messageId}`);
            return;
        }

        await this.chatService.sendMessage(
            ticket.id,
            content,
            false,              // fromMe = false (mensagem do cliente)
            messageType,
            mediaUrl,
            companyId,
            payload.messageId,  // externalId para rastreamento de status
        );

        this.logger.log(`Mensagem salva no ticket ${ticket.id} [${messageType}]`);
    }

    private async handleMessageStatus(payload: any) {
        // Z-API envia um ARRAY de IDs (campo "ids"), não um único "messageId"
        const { instanceId, ids, status: zapiStatus } = payload;

        if (!ids || !Array.isArray(ids) || ids.length === 0) return;

        try {
            const companyId = await this.resolveCompanyId(instanceId);
            if (!companyId) return;

            const internalStatus = ZAPI_STATUS_MAP[zapiStatus] || 'SENT';

            for (const externalId of ids) {
                const message = await (this.prisma as any).message.findFirst({
                    where: {
                        externalId,
                        ticket: { companyId },
                    } as any,
                });

                if (message) {
                    await (this.prisma as any).message.update({
                        where: { id: message.id },
                        data: { status: internalStatus as any },
                    });

                    this.chatGateway.emitMessageStatusUpdate(message.ticketId, message.id, internalStatus);
                }
            }
        } catch (e: any) {
            this.logger.debug(`Erro ao atualizar status de mensagem: ${e.message}`);
        }
    }

    private async handlePresenceUpdate(payload: any) {
        const { instanceId, phone, status } = payload;

        // Z-API: COMPOSING e RECORDING indicam que o contato está interagindo
        const isTyping = status === 'COMPOSING' || status === 'RECORDING';

        const companyId = await this.resolveCompanyId(instanceId);
        if (!companyId) return;

        const ticket = await (this.prisma as any).ticket.findFirst({
            where: {
                contact: { phoneNumber: phone },
                companyId,
                status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] as any },
            },
        });

        if (ticket) {
            this.chatGateway.emitPresenceUpdate(ticket.id, isTyping);
        }
    }

    private async handleInstanceStatus(payload: any, status: 'CONNECTED' | 'DISCONNECTED') {
        const { instanceId } = payload;

        try {
            await this.prisma.whatsAppInstance.update({
                where: { zapiInstanceId: instanceId },
                data: { status },
            });
            this.logger.log(`Instância ${instanceId} → ${status}`);
        } catch (e: any) {
            // Instância pode estar no Integration (global), não em WhatsAppInstance
            this.logger.debug(`Não atualizou status de ${instanceId}: ${e.message}`);
        }
    }
}
