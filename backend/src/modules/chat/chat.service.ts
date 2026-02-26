import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ChatGateway } from './chat.gateway';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { AIService } from '../ai/ai.service';
import { EvaluationsService } from '../evaluations/evaluations.service';
import { MessageType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(
        private prisma: PrismaService,
        private chatGateway: ChatGateway,
        @Inject(forwardRef(() => WhatsAppService)) private whatsappService: WhatsAppService,
        private aiService: AIService,
        @Inject(forwardRef(() => EvaluationsService)) private evaluationsService: EvaluationsService,
        private eventEmitter: EventEmitter2,
    ) { }

    async validateTicketOwnership(ticketId: string, companyId: string) {
        const ticket = await this.prisma.ticket.findFirst({
            where: {
                id: ticketId,
                companyId
            }
        });

        if (!ticket) {
            throw new Error('Ticket não encontrado ou acesso negado para esta empresa');
        }

        return ticket;
    }

    async sendMessage(ticketId: string, content: string, fromMe: boolean, type: string = 'TEXT', mediaUrl?: string, companyId?: string, origin: 'AGENT' | 'CLIENT' | 'AI' = 'AGENT') {
        this.logger.log(`Processando mensagem para o ticket: ${ticketId} (${origin})`);

        return await this.prisma.$transaction(async (tx) => {
            const message = await tx.message.create({
                data: {
                    ticketId,
                    content,
                    fromMe,
                    origin: fromMe ? (origin === 'AI' ? 'AI' : 'AGENT') : 'CLIENT',
                    messageType: (type as any) || 'TEXT',
                    mediaUrl,
                    status: 'PENDING',
                    sentAt: new Date(),
                },
            });

            const ticket = await tx.ticket.findUnique({
                where: { id: ticketId },
                include: { contact: true }
            });

            if (!ticket) throw new Error('Ticket não encontrado');

            const updateData: any = {
                updatedAt: new Date(),
            };

            if (!fromMe) {
                updateData.unreadMessages = { increment: 1 };
            } else if (!ticket.firstResponseAt) {
                updateData.firstResponseAt = new Date();
            }

            await tx.ticket.update({
                where: { id: ticketId },
                data: updateData,
            });

            this.chatGateway.emitNewMessage(ticket.companyId, ticketId, message);

            if (fromMe && type !== 'INTERNAL') {
                this.sendExternalMessage(ticket, message).catch(err => {
                    this.logger.error(`Erro no envio assíncrono WhatsApp: ${err.message}`);
                });
            } else if (!fromMe) {
                this.handleIncomingClientMessage(ticket, content);
            }

            // Detecção de menções em notas internas
            if (type === 'INTERNAL' && content.includes('@')) {
                this.handleMentions(ticket.companyId, ticketId, content, message.id).catch(err => {
                    this.logger.error(`Erro ao processar menções: ${err.message}`);
                });
            }

            return message;
        });
    }

    private async handleMentions(companyId: string, ticketId: string, content: string, messageId: string) {
        const mentionRegex = /@(\w+)/g;
        const matches = [...content.matchAll(mentionRegex)];

        if (matches.length > 0) {
            const usernames = matches.map(m => m[1]);

            const users = await this.prisma.user.findMany({
                where: {
                    companyId,
                    OR: [
                        { name: { in: usernames, mode: 'insensitive' } },
                        { email: { in: usernames, mode: 'insensitive' } }
                    ]
                }
            });

            for (const user of users) {
                // Emitir via WebSocket (tempo real na UI)
                this.chatGateway.emitMention(companyId, user.id, {
                    ticketId,
                    messageId,
                    mentionContent: content
                });

                // Emitir via EventEmitter2 para NotificationsService criar notificação persistente
                this.eventEmitter.emit('ticket.mention', {
                    userId: user.id,
                    companyId,
                    ticketId,
                    mentionContent: content.slice(0, 200),
                });
            }
        }
    }

    private async sendExternalMessage(ticket: any, message: any) {
        try {
            let externalResult;
            switch (message.messageType) {
                case 'IMAGE':
                    externalResult = await this.whatsappService.sendImage(ticket.companyId, ticket.connectionId, ticket.contact.phoneNumber, message.mediaUrl, message.content);
                    break;
                case 'AUDIO':
                    externalResult = await this.whatsappService.sendAudio(ticket.companyId, ticket.connectionId, ticket.contact.phoneNumber, message.mediaUrl);
                    break;
                case 'VIDEO':
                    externalResult = await this.whatsappService.sendVideo(ticket.companyId, ticket.connectionId, ticket.contact.phoneNumber, message.mediaUrl, message.content);
                    break;
                case 'DOCUMENT':
                    const fileName = message.mediaUrl.split('/').pop() || 'documento';
                    const ext = fileName.split('.').pop() || 'pdf';
                    externalResult = await this.whatsappService.sendDocument(ticket.companyId, ticket.connectionId, ticket.contact.phoneNumber, message.mediaUrl, fileName, ext);
                    break;
                default:
                    externalResult = await this.whatsappService.sendMessage(ticket.companyId, ticket.connectionId, ticket.contact.phoneNumber, message.content);
            }

            await this.prisma.message.update({
                where: { id: message.id },
                data: { status: 'SENT', externalId: externalResult?.zaapId || externalResult?.id }
            });
        } catch (error) {
            this.logger.error(`Falha no envio WhatsApp: ${error.message}`);
            await this.prisma.message.update({
                where: { id: message.id },
                data: { status: 'FAILED' }
            });
        }
    }

    private handleIncomingClientMessage(ticket: any, content: string) {
        this.handleAIResponse(ticket.id, content).catch(err => {
            this.logger.error(`Erro no fluxo de IA: ${err.message}`);
        });

        this.evaluationsService.generateAISentimentAnalysis(ticket.companyId, ticket.id).catch(err => {
            this.logger.error(`Erro ao disparar análise de sentimento: ${err.message}`);
        });
    }

    private async handleAIResponse(ticketId: string, content: string) {
        try {
            // Busca ticket+mensagens em paralelo para eliminar N+1 sequencial
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            // Primeiro, buscar apenas o ticket para obter o companyId
            const ticket = await this.prisma.ticket.findUnique({
                where: { id: ticketId },
                include: {
                    department: true,
                    contact: true,
                    company: { select: { limitTokens: true } },
                },
            });

            if (!ticket?.department?.aiAgentId) {
                return;
            }

            // VALIDAR MODO: Só responde automaticamente se estiver em modo IA ou HIBRIDO
            const ticketMode = (ticket as any).mode || 'MANUAL';
            if (ticketMode === 'MANUAL' || ticketMode === 'HUMAN') {
                this.logger.log(`IA ignorada para o ticket ${ticketId}: Modo ${ticketMode}`);
                return;
            }

            // Buscar mensagens e uso de tokens em paralelo (agora que temos ticket.companyId)
            const [messages, currentUsage] = await Promise.all([
                this.prisma.message.findMany({
                    where: { ticketId },
                    orderBy: { sentAt: 'desc' },
                    take: 11,
                }),
                // Usar transação para garantir atomicidade na verificação de limite
                this.prisma.aIUsage.aggregate({
                    where: { companyId: ticket.companyId, createdAt: { gte: startOfMonth } },
                    _sum: { tokens: true },
                }).catch(() => ({ _sum: { tokens: 0 } })),
            ]);

            // Verificar limite de tokens com atomicidade
            const tokenLimit = (ticket as any).company?.limitTokens ?? 100000;
            const estimatedTokens = Math.ceil((content.length + 200) / 4); // Estimativa conservadora
            const currentTokens = currentUsage._sum.tokens || 0;

            if (currentTokens + estimatedTokens >= tokenLimit) {
                this.logger.warn(`Limite de IA atingido para a empresa ${ticket.companyId}`);
                return;
            }

            const history = messages
                .filter(m => m.content !== content)
                .reverse()
                .map(m => ({
                    role: m.fromMe ? 'assistant' : 'user',
                    content: m.content
                }));

            const aiResponse = await this.aiService.chat(ticket.companyId, ticket.department.aiAgentId, content, history);

            if (aiResponse) {
                await this.sendMessage(ticketId, aiResponse, true, 'TEXT', undefined, ticket.companyId, 'AI');
                await this.prisma.aIUsage.create({
                    data: {
                        companyId: ticket.companyId,
                        tokens: Math.ceil((content.length + aiResponse.length) / 4),
                        cost: 0
                    }
                });
            }
        } catch (error) {
            this.logger.error(`Erro ao processar resposta de IA: ${error.message}`);
        }
    }

    async getTicketMessages(ticketId: string, companyId: string, limit: number = 50) {
        await this.validateTicketOwnership(ticketId, companyId);
        const takeValue = Number(limit) || 50;
        return this.prisma.message.findMany({
            where: { ticketId },
            orderBy: { sentAt: 'desc' },
            take: takeValue,
        }).then(messages => messages.reverse());
    }

    async getMessagesCursor(ticketId: string, companyId: string, cursor?: string, limit: number = 50) {
        await this.validateTicketOwnership(ticketId, companyId);
        return this.prisma.message.findMany({
            where: { ticketId },
            take: Number(limit),
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { sentAt: 'desc' }
        });
    }

    async getMacros(companyId: string) {
        return this.prisma.cannedResponse.findMany({
            where: { companyId },
            orderBy: { title: 'asc' }
        });
    }

    async createMacro(companyId: string, data: { title: string, content: string }) {
        return this.prisma.cannedResponse.create({
            data: {
                ...data,
                companyId
            }
        });
    }

    async markAsRead(ticketId: string, companyId: string) {
        await this.validateTicketOwnership(ticketId, companyId);
        await this.prisma.ticket.update({
            where: { id: ticketId },
            data: { unreadMessages: 0 }
        });
        return this.prisma.message.updateMany({
            where: {
                ticketId,
                fromMe: false,
                readAt: null,
            },
            data: {
                readAt: new Date(),
            },
        });
    }

    async transcribe(messageId: string, companyId: string) {
        const message = await this.prisma.message.findUnique({
            where: { id: messageId },
            include: { ticket: { include: { department: true } } }
        });

        if (!message || message.ticket.companyId !== companyId) {
            throw new Error('Mensagem não encontrada ou acesso negado');
        }

        if (message.messageType !== MessageType.AUDIO) {
            throw new Error('Mensagem não é um áudio');
        }

        if (message.transcription) {
            return { transcription: message.transcription };
        }

        const agentId = message.ticket.department.aiAgentId;
        if (!agentId) {
            throw new Error('Nenhum agente de IA configurado para este departamento');
        }

        const transcription = await this.aiService.transcribeAudio(message.mediaUrl);
        const updatedMessage = await this.prisma.message.update({
            where: { id: messageId },
            data: { transcription }
        });

        return { transcription: updatedMessage.transcription };
    }
}
