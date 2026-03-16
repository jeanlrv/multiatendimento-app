import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { CryptoService } from '../../common/services/crypto.service';
import { LockService } from '../workflows/core/lock.service';
import { MessageType } from '@prisma/client';

const ZAPI_STATUS_MAP: Record<string, string> = {
    SENT: 'SENT',
    RECEIVED: 'DELIVERED',
    READ: 'READ',
    READ_BY_ME: 'READ',
    PLAYED: 'READ',
};

@Injectable()
export class WebhookProcessingService {
    readonly logger = new Logger(WebhookProcessingService.name);

    constructor(
        private prisma: PrismaService,
        @Inject(forwardRef(() => ChatService)) private chatService: ChatService,
        @Inject(forwardRef(() => ChatGateway)) private chatGateway: ChatGateway,
        private crypto: CryptoService,
        private eventEmitter: EventEmitter2,
        private lockService: LockService,
    ) { }

    async validateZApiToken(instanceId: string, incomingToken?: string): Promise<boolean> {
        const connection = await this.prisma.whatsAppInstance.findUnique({
            where: { zapiInstanceId: instanceId },
        });

        let storedToken: string | null = null;

        if (connection) {
            storedToken = (connection as any).zapiClientToken ?? null;
        } else {
            const integration = await this.prisma.integration.findFirst({
                where: { zapiInstanceId: instanceId, isActive: true },
            });
            storedToken = (integration as any)?.zapiClientToken ?? null;
        }

        if (incomingToken && storedToken) {
            const decryptedToken = this.crypto.decrypt(storedToken);
            // Comparação timing-safe previne timing attacks (evita inferir token por tempo de resposta)
            const a = Buffer.from(incomingToken);
            const b = Buffer.from(decryptedToken);
            const equal = a.length === b.length && timingSafeEqual(a, b);
            if (!equal) {
                this.logger.warn(`Webhook Z-API rejeitado: clientToken não confere para instanceId=${instanceId}`);
                return false;
            }
        } else if (incomingToken && !storedToken) {
            this.logger.warn(
                `⚠️ instanceId=${instanceId}: Z-API enviou clientToken mas sistema não tem token configurado. ` +
                `Configure o Security Token na conexão para validar webhooks.`
            );
        }

        return true;
    }

    async resolveCompanyId(instanceId: string): Promise<string | null> {
        const connection = await this.prisma.whatsAppInstance.findUnique({
            where: { zapiInstanceId: instanceId },
        });
        if (connection) return connection.companyId;

        const integration = await this.prisma.integration.findFirst({
            where: { zapiInstanceId: instanceId, isActive: true },
        });
        if (integration) return integration.companyId;

        return null;
    }

    private checkBusinessHours(department: any): string | null {
        if (!department.businessHours || !department.outOfHoursMessage) {
            return null;
        }

        try {
            const bh = typeof department.businessHours === 'string'
                ? JSON.parse(department.businessHours)
                : department.businessHours;

            const timezone = department.timezone || 'America/Sao_Paulo';

            // Usar Intl.DateTimeFormat para conversão confiável de timezone (independe de locale do OS)
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false,
            });
            const parts = Object.fromEntries(
                formatter.formatToParts(new Date()).map(p => [p.type, p.value])
            );
            const localHour = parseInt(parts.hour, 10);
            const localMinute = parseInt(parts.minute, 10);
            // Intl.DateTimeFormat não tem dayOfWeek direto, usamos toLocaleString
            const dayOfWeek = new Date(
                parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day)
            ).getDay().toString();

            const dayConfig = bh[dayOfWeek];

            this.logger.log(
                `[BH Debug] Dept "${department.name}" | TZ: ${timezone} | ` +
                `Hora local: ${parts.hour}:${parts.minute} | Dia: ${dayOfWeek} | ` +
                `Config: ${dayConfig ? `${dayConfig.start}-${dayConfig.end}` : 'FECHADO'} | ` +
                `BH keys: ${Object.keys(bh).join(',')}`
            );

            if (!dayConfig || !dayConfig.start || !dayConfig.end) {
                return department.outOfHoursMessage;
            }

            const [startH, startM] = dayConfig.start.split(':').map(Number);
            const [endH, endM] = dayConfig.end.split(':').map(Number);

            const currentMinutes = localHour * 60 + localMinute;
            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;

            if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
                this.logger.log(`[BH Debug] FORA do horário: ${currentMinutes}min < ${startMinutes}min ou >= ${endMinutes}min`);
                return department.outOfHoursMessage;
            }

            this.logger.log(`[BH Debug] DENTRO do horário comercial`);
            return null;
        } catch (err) {
            this.logger.warn(`Erro ao verificar horário comercial: ${err.message}`);
            return null;
        }
    }

    extractMessageContent(payload: any): {
        messageType: MessageType;
        content: string;
        mediaUrl?: string;
    } {
        if (payload.text?.message) {
            return { messageType: MessageType.TEXT, content: payload.text.message };
        }
        if (payload.image) {
            const url = typeof payload.image === 'string' ? payload.image : (payload.image?.imageUrl || payload.image?.url);
            return { messageType: MessageType.IMAGE, content: payload.image?.caption || '[Imagem]', mediaUrl: url };
        }
        if (payload.audio) {
            const url = typeof payload.audio === 'string' ? payload.audio : (payload.audio?.audioUrl || payload.audio?.url);
            return { messageType: MessageType.AUDIO, content: '[Áudio]', mediaUrl: url };
        }
        if (payload.video) {
            const url = typeof payload.video === 'string' ? payload.video : (payload.video?.videoUrl || payload.video?.url);
            return { messageType: MessageType.VIDEO, content: payload.video?.caption || '[Vídeo]', mediaUrl: url };
        }
        if (payload.document) {
            const url = typeof payload.document === 'string' ? payload.document : (payload.document?.documentUrl || payload.document?.url);
            return { messageType: MessageType.DOCUMENT, content: payload.document?.fileName || '[Documento]', mediaUrl: url };
        }
        if (payload.sticker) {
            const url = typeof payload.sticker === 'string' ? payload.sticker : payload.sticker?.stickerUrl;
            return { messageType: MessageType.STICKER, content: '[Sticker]', mediaUrl: url };
        }
        if (payload.location) {
            const { latitude, longitude } = payload.location;
            return { messageType: MessageType.LOCATION, content: `[Localização: ${latitude}, ${longitude}]` };
        }
        if (payload.contact) {
            return { messageType: MessageType.CONTACT, content: '[Contato compartilhado]' };
        }
        if (payload.buttonResponse?.selectedButtonLabel || payload.listResponse?.selectedTitle) {
            const text = payload.buttonResponse?.selectedButtonLabel || payload.listResponse?.selectedTitle;
            return { messageType: MessageType.TEXT, content: text };
        }

        // Fallback: capturar formatos alternativos da Z-API (body, message direto, text como string)
        const fallbackText =
            payload.body ||
            payload.message ||
            (typeof payload.text === 'string' ? payload.text : null) ||
            payload.caption ||
            '';

        if (fallbackText) {
            this.logger.debug(`[extractMessageContent] Conteúdo capturado via fallback: "${String(fallbackText).substring(0, 80)}"`);
            return { messageType: MessageType.TEXT, content: String(fallbackText) };
        }

        this.logger.warn(`[extractMessageContent] Nenhum conteúdo extraído do payload. Keys: ${Object.keys(payload).join(', ')}`);
        return { messageType: MessageType.TEXT, content: '' };
    }

    private async findOrCreateCustomer(companyId: string, phonePrimary: string, name?: string): Promise<string> {
        const existing = await (this.prisma as any).customer.findFirst({
            where: { phonePrimary, companyId },
            select: { id: true },
        });
        if (existing) return existing.id;
        const created = await (this.prisma as any).customer.create({
            data: { name: name || phonePrimary, phonePrimary, companyId },
            select: { id: true },
        });
        return created.id;
    }

    async processIncomingMessage(payload: any): Promise<void> {
        if (payload.fromMe === true) {
            this.logger.debug(`[MSG] Ignorada (fromMe=true): ${payload.messageId}`);
            return;
        }

        if (payload.isGroup === true || payload.isNewsletter === true) {
            this.logger.debug(`[MSG] Ignorada (grupo/newsletter): ${payload.phone}`);
            return;
        }

        if (
            payload.isStatus === true ||
            payload.phone?.includes('@broadcast') ||
            payload.phone?.includes('@status') ||
            payload.reactionMessage
        ) {
            this.logger.debug(`[MSG] Ignorada (status/reação): ${payload.phone}`);
            return;
        }

        const phoneNumber: string = payload.phone;
        const instanceId: string = payload.instanceId;

        if (!phoneNumber || !instanceId) {
            this.logger.warn('[MSG] Webhook sem phone ou instanceId');
            return;
        }

        this.logger.log(`[MSG] Processando mensagem de ${phoneNumber} (instanceId: ${instanceId})`);

        const companyId = await this.resolveCompanyId(instanceId);
        if (!companyId) {
            this.logger.warn(`[MSG] Empresa não encontrada para instanceId: ${instanceId}`);
            return;
        }

        const connection = await this.prisma.whatsAppInstance.findUnique({
            where: { zapiInstanceId: instanceId },
            include: { department: true },
        });

        if (!connection) {
            this.logger.warn(`Conexão não encontrada para instanceId: ${instanceId}`);
            return;
        }

        // Distributed lock: evita race condition (TOCTOU) na criação de contato/ticket
        const lockKey = `webhook:${companyId}:${phoneNumber}`;
        const lockAcquired = await this.lockService.acquireWithRetry(lockKey, 15_000, 5, 200);
        if (!lockAcquired) {
            this.logger.warn(`[MSG] Lock não obtido para ${lockKey} — descartando payload duplicado`);
            return;
        }

        try {
            let contact = await this.prisma.contact.findFirst({
                where: { phoneNumber, companyId },
            });

            const contactName = payload.senderName || payload.chatName || phoneNumber;

            if (!contact) {
                const customerId = await this.findOrCreateCustomer(companyId, phoneNumber, contactName);
                contact = await this.prisma.contact.create({
                    data: {
                        phoneNumber,
                        name: contactName,
                        profilePicture: payload.senderPhoto || null,
                        company: { connect: { id: companyId } },
                        ...({ customerId } as any),
                    },
                });
            } else {
                if (!(contact as any).customerId) {
                    const customerId = await this.findOrCreateCustomer(
                        companyId, phoneNumber, contact.name || contactName,
                    );
                    await this.prisma.contact.update({
                        where: { id: contact.id },
                        data: { ...({ customerId } as any) },
                    });
                }
                if (payload.senderPhoto && contact.profilePicture !== payload.senderPhoto) {
                    contact = await this.prisma.contact.update({
                        where: { id: contact.id },
                        data: {
                            profilePicture: payload.senderPhoto,
                            name: payload.senderName || contact.name,
                        },
                    });
                }
            }

            if (contact.csatPending) {
                const text = (payload.text?.message || payload.body || '').trim();
                const score = parseInt(text, 10);
                if (score >= 1 && score <= 5) {
                    const csatTicketId = contact.csatTicketId;
                    if (csatTicketId) {
                        // Upsert garante que a nota seja salva mesmo sem registro prévio
                        await this.prisma.evaluation.upsert({
                            where: { ticketId: csatTicketId },
                            update: { customerRating: score },
                            create: {
                                ticketId: csatTicketId,
                                companyId,
                                customerRating: score,
                                aiSentiment: 'NEUTRAL' as any,
                                aiSentimentScore: 5,
                                aiJustification: 'Aguardando análise de sentimento',
                                aiSummary: '',
                            },
                        });

                        // Enviar mensagem pós-avaliação (se configurada)
                        const resolvedTicket = await this.prisma.ticket.findUnique({
                            where: { id: csatTicketId },
                            select: { connectionId: true },
                        });
                        const postEvalSetting = await this.prisma.setting.findFirst({
                            where: { companyId, key: 'post_evaluation_message' },
                            select: { value: true },
                        });
                        if (postEvalSetting?.value && resolvedTicket?.connectionId) {
                            let postMsg: string | null = null;
                            const rawVal = String(postEvalSetting.value);
                            try { postMsg = JSON.parse(rawVal); } catch { postMsg = rawVal.replace(/^"|"$/g, ''); }
                            if (postMsg) {
                                this.eventEmitter.emit('csat.pending', {
                                    companyId,
                                    ticketId: csatTicketId,
                                    connectionId: resolvedTicket.connectionId,
                                    phoneNumber: contact.phoneNumber,
                                    message: postMsg,
                                });
                            }
                        }
                    }
                    await this.prisma.contact.update({
                        where: { id: contact.id },
                        data: { csatPending: false, csatTicketId: null },
                    });
                    this.logger.log(`CSAT registrado: contato ${contact.id} avaliou ${score}/5 no ticket ${csatTicketId}`);
                    this.eventEmitter.emit('csat.received', {
                        ticketId: csatTicketId,
                        companyId,
                        customerRating: score,
                        contactId: contact.id,
                    });
                    return;
                } else {
                    await this.prisma.contact.update({
                        where: { id: contact.id },
                        data: { csatPending: false, csatTicketId: null },
                    });
                }
            }

            let ticket = await this.prisma.ticket.findFirst({
                where: {
                    contactId: contact.id,
                    companyId,
                    status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] as any },
                },
                include: { department: true },
            });

            if (!ticket) {
                let department = connection.department;

                if (!department && connection.departmentIds?.length > 0) {
                    department = await this.prisma.department.findUnique({
                        where: { id: connection.departmentIds[0] },
                    });
                    if (department) {
                        this.logger.debug(`Departamento resolvido via departmentIds[0]: ${department.id}`);
                    }
                }

                if (!department) {
                    this.logger.warn(`Conexão ${connection.id} não possui departamento vinculado`);
                    return;
                }

                const { content, messageType: firstMsgType, mediaUrl: firstMsgMedia } = this.extractMessageContent(payload);

                ticket = await this.prisma.ticket.create({
                    data: {
                        contact: { connect: { id: contact.id } },
                        department: { connect: { id: department.id } },
                        whatsappInstance: { connect: { id: connection.id } },
                        company: { connect: { id: companyId } },
                        status: 'OPEN' as any,
                        mode: department.defaultMode || 'AI',
                        subject: content.substring(0, 100) || 'Novo Atendimento',
                    },
                    include: { department: true },
                });

                this.logger.log(`Novo ticket criado: ${ticket.id} — Contato: ${phoneNumber}`);

                const outOfHoursMsg = this.checkBusinessHours(department);

                if (outOfHoursMsg) {
                    await this.chatService.sendMessage(ticket.id, outOfHoursMsg, true, 'TEXT', undefined, companyId, 'AGENT');
                } else {
                    const greeting = department.greetingMessage
                        || `Olá! Seu atendimento foi iniciado no setor ${department.name}. Aguarde, em breve alguém irá te ajudar.`;
                    await this.chatService.sendMessage(ticket.id, greeting, true, MessageType.TEXT, undefined, companyId, 'AGENT');
                }

                if (content || firstMsgMedia) {
                    await this.chatService.sendMessage(
                        ticket.id,
                        content,
                        false,
                        firstMsgType,
                        firstMsgMedia,
                        companyId,
                        'CLIENT',
                        undefined,
                        payload.messageId,
                    );
                }

                return;
            }

            const { messageType, content, mediaUrl } = this.extractMessageContent(payload);

            if (!content && !mediaUrl) {
                this.logger.debug(`Mensagem sem conteúdo ignorada: ${payload.messageId}`);
                return;
            }

            await this.chatService.sendMessage(
                ticket.id,
                content,
                false,
                messageType,
                mediaUrl,
                companyId,
                'CLIENT',
                undefined,
                payload.messageId,
            );

            this.logger.log(`Mensagem salva no ticket ${ticket.id} [${messageType}]`);
        } finally {
            await this.lockService.release(lockKey);
        }
    }

    async processMessageStatus(payload: any): Promise<void> {
        const { instanceId, ids, status: zapiStatus } = payload;

        if (!ids || !Array.isArray(ids) || ids.length === 0) return;

        try {
            const companyId = await this.resolveCompanyId(instanceId);
            if (!companyId) return;

            const internalStatus = ZAPI_STATUS_MAP[zapiStatus] || 'SENT';

            for (const externalId of ids) {
                const message = await this.prisma.message.findFirst({
                    where: {
                        externalId,
                        ticket: { companyId },
                    } as any,
                });

                if (message) {
                    await this.prisma.message.update({
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

    async processPresenceUpdate(payload: any): Promise<void> {
        const { instanceId, phone, status } = payload;
        const isTyping = status === 'COMPOSING' || status === 'RECORDING';

        const companyId = await this.resolveCompanyId(instanceId);
        if (!companyId) return;

        const ticket = await this.prisma.ticket.findFirst({
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

    async processInstanceStatus(payload: any, status: 'CONNECTED' | 'DISCONNECTED'): Promise<void> {
        const { instanceId } = payload;

        try {
            await this.prisma.whatsAppInstance.update({
                where: { zapiInstanceId: instanceId },
                data: { status },
            });
            this.logger.log(`Instância ${instanceId} → ${status}`);
        } catch (e: any) {
            this.logger.debug(`Não atualizou status de ${instanceId}: ${e.message}`);
        }
    }
}
