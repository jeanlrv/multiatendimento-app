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

    async sendMessage(ticketId: string, content: string, fromMe: boolean, type: string = 'TEXT', mediaUrl?: string, companyId?: string, origin: 'AGENT' | 'CLIENT' | 'AI' = 'AGENT', quotedMessageId?: string, externalId?: string) {
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
                    quotedMessageId,
                    externalId: externalId || undefined,
                },
            });

            const ticket = await tx.ticket.findUnique({
                where: { id: ticketId },
                include: { contact: true }
            });

            if (!ticket) throw new Error('Ticket não encontrado');

            const updateData: any = {
                updatedAt: new Date(),
                lastMessageAt: new Date(),
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
                    externalResult = await this.whatsappService.sendImage(ticket.connectionId, ticket.contact.phoneNumber, message.mediaUrl, ticket.companyId, message.content);
                    break;
                case 'AUDIO':
                    externalResult = await this.whatsappService.sendPttAudio(ticket.connectionId, ticket.contact.phoneNumber, message.mediaUrl, ticket.companyId);
                    break;
                case 'VIDEO':
                    externalResult = await this.whatsappService.sendVideo(ticket.connectionId, ticket.contact.phoneNumber, message.mediaUrl, ticket.companyId, message.content);
                    break;
                case 'DOCUMENT':
                    const fileName = message.mediaUrl.split('/').pop() || 'documento';
                    const ext = fileName.split('.').pop() || 'pdf';
                    externalResult = await this.whatsappService.sendDocument(ticket.connectionId, ticket.contact.phoneNumber, message.mediaUrl, fileName, ext, ticket.companyId);
                    break;
                default:
                    externalResult = await this.whatsappService.sendMessage(ticket.connectionId, ticket.contact.phoneNumber, message.content, ticket.companyId);
            }

            await this.prisma.message.update({
                where: { id: message.id },
                data: { status: 'SENT', externalId: externalResult?.zaapId || externalResult?.id }
            });
            this.chatGateway.emitMessageStatusUpdate(ticket.id, message.id, 'SENT');
        } catch (error) {
            this.logger.error(`Falha no envio WhatsApp: ${error.message}`);
            await this.prisma.message.update({
                where: { id: message.id },
                data: { status: 'FAILED' }
            });
            this.chatGateway.emitMessageStatusUpdate(ticket.id, message.id, 'FAILED');
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
            const ticket = await this.prisma.ticket.findUnique({
                where: { id: ticketId },
                include: {
                    department: true,
                    contact: true,
                },
            });

            if (!ticket?.department?.aiAgentId) {
                this.logger.warn(`IA desabilitada para ticket ${ticketId}: departamento ${ticket?.department?.id} sem aiAgentId configurado`);
                return;
            }

            // VALIDAR MODO: Só responde automaticamente se estiver em modo IA ou HIBRIDO
            const ticketMode = (ticket as any).mode || 'MANUAL';
            if (ticketMode !== 'AI' && ticketMode !== 'HIBRIDO') {
                this.logger.log(`IA ignorada para o ticket ${ticketId}: Modo ${ticketMode}`);
                return;
            }

            const messages = await this.prisma.message.findMany({
                where: { ticketId },
                orderBy: { sentAt: 'desc' },
                take: 11,
            });

            const history = messages
                .filter(m => m.content !== content)
                .reverse()
                .map(m => ({
                    role: m.fromMe ? 'assistant' : 'user',
                    content: m.content
                }));

            // Buscar departamentos disponíveis para injetar instruções de roteamento
            const departments = await this.prisma.department.findMany({
                where: { companyId: ticket.companyId },
                select: { id: true, name: true },
            });
            // Excluir o departamento ATUAL para evitar loop de auto-transferência
            const otherDepts = departments.filter(d => d.id !== ticket.departmentId);
            const deptNames = otherDepts.length > 0
                ? otherDepts.map(d => d.name).join(', ')
                : '(nenhum outro departamento disponível)';
            const currentDeptName = ticket.department?.name ?? 'desconhecido';

            // Data/hora local no fuso do departamento
            const deptTimezone = (ticket.department as any)?.timezone || 'America/Sao_Paulo';
            const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: deptTimezone }));
            const dateStr = nowLocal.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const timeStr = nowLocal.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const routingInstructions = [
                '========================================',
                '[INSTRUÇÕES DE ROTEAMENTO — NÃO EXIBA AO CLIENTE]',
                '========================================',
                `Data e hora atual: ${dateStr}, ${timeStr} (${deptTimezone})`,
                `Você está ATUALMENTE no departamento: ${currentDeptName}`,
                'Você pode usar EXCLUSIVAMENTE um dos comandos abaixo quando necessário:',
                '',
                `• [TRANSFERIR:NomeDoDepartamento] — transfere para outro departamento (IA do destino assume)`,
                `• [HUMANO] — transfere para um atendente humano neste mesmo departamento`,
                `• [FINALIZAR] — encerra o atendimento (use apenas quando tudo estiver resolvido)`,
                '',
                `Departamentos para onde você pode transferir: ${deptNames}`,
                '',
                'REGRAS IMPORTANTES:',
                '1. Use [TRANSFERIR:X] SOMENTE para departamentos da lista acima — NUNCA para o seu departamento atual.',
                '2. Use [HUMANO] quando você não consegue resolver e o cliente precisa de uma pessoa.',
                '3. Use [FINALIZAR] apenas quando o atendimento estiver completamente concluído.',
                '4. Os comandos substituem COMPLETAMENTE sua resposta — não inclua texto adicional.',
                '5. Para respostas normais, responda naturalmente sem usar nenhum comando.',
                '========================================',
            ].join('\n');

            // AIService.chat() já verifica limites de tokens e registra uso
            const aiResponse = await this.aiService.chat(ticket.companyId, ticket.department.aiAgentId, content, history, undefined, routingInstructions);

            if (!aiResponse) return;

            // Detectar comando de roteamento: [TRANSFERIR:NomeDepartamento], [HUMANO] ou [FINALIZAR]
            const transferMatch = aiResponse.match(/\[TRANSFERIR:([^\]]+)\]/i);
            const humanMatch = aiResponse.match(/\[HUMANO\]/i);
            const finalizeMatch = aiResponse.match(/\[FINALIZAR\]/i);

            if (transferMatch) {
                const deptName = transferMatch[1].trim();
                const targetDept = await this.prisma.department.findFirst({
                    where: {
                        companyId: ticket.companyId,
                        name: { equals: deptName, mode: 'insensitive' },
                    },
                });
                if (targetDept) {
                    // Guard: não transferir para o mesmo departamento atual
                    if (targetDept.id === ticket.departmentId) {
                        this.logger.warn(`IA tentou transferir para o mesmo departamento atual "${deptName}" — ignorado`);
                        return;
                    }
                    await this.prisma.ticket.update({
                        where: { id: ticketId },
                        data: { departmentId: targetDept.id },
                    });
                    this.eventEmitter.emit('ticket.transferred', {
                        ticketId,
                        companyId: ticket.companyId,
                        fromDepartmentId: ticket.departmentId,
                        toDepartmentId: targetDept.id,
                    });
                    // Avisar o cliente da transferência sem expor o comando interno
                    await this.sendMessage(
                        ticketId,
                        `Vou te encaminhar para o departamento *${targetDept.name}*. Um momento! 🔄`,
                        true, 'TEXT', undefined, ticket.companyId, 'AI'
                    );
                    this.logger.log(`IA transferiu ticket ${ticketId} para departamento "${deptName}"`);
                } else {
                    this.logger.warn(`IA tentou transferir para departamento "${deptName}" não encontrado`);
                }
                return;
            }

            if (humanMatch) {
                await this.prisma.ticket.update({
                    where: { id: ticketId },
                    data: { mode: 'HUMANO' },
                });
                this.eventEmitter.emit('ticket.status_changed', { ticketId, companyId: ticket.companyId });
                await this.sendMessage(
                    ticketId,
                    'Vou transferir você para um de nossos atendentes. Aguarde um momento! 👤',
                    true, 'TEXT', undefined, ticket.companyId, 'AI'
                );
                this.logger.log(`IA transferiu ticket ${ticketId} para atendimento humano`);
                return;
            }

            if (finalizeMatch) {
                await this.prisma.ticket.update({
                    where: { id: ticketId },
                    data: { status: 'RESOLVED', resolvedAt: new Date() },
                });
                this.eventEmitter.emit('ticket.resolved', { ticketId, companyId: ticket.companyId });
                this.logger.log(`IA finalizou ticket ${ticketId}`);
                return; // Não enviar o texto do comando ao cliente
            }

            await this.sendMessage(ticketId, this.sanitizeForWhatsApp(aiResponse), true, 'TEXT', undefined, ticket.companyId, 'AI');
        } catch (error) {
            this.logger.error(`Erro ao processar resposta de IA: ${error.message}`);
        }
    }

    /** Converte markdown padrão para formato WhatsApp antes de enviar */
    private sanitizeForWhatsApp(text: string): string {
        return text
            .replace(/\*\*(.+?)\*\*/gs, '*$1*')          // **bold** → *bold*
            .replace(/__(.+?)__/gs, '_$1_')                // __italic__ → _italic_
            .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')         // # Heading → *Heading*
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')       // [link](url) → link
            .replace(/`{3}[\s\S]*?`{3}/g, '')              // remover blocos de código
            .replace(/`([^`]+)`/g, '$1')                   // `inline code` → texto
            .trim();
    }

    async getTicketMessages(ticketId: string, companyId: string, limit: number = 50) {
        await this.validateTicketOwnership(ticketId, companyId);
        const takeValue = Number(limit) || 50;
        return this.prisma.message.findMany({
            where: { ticketId },
            orderBy: { sentAt: 'desc' },
            take: takeValue,
            include: {
                quotedMessage: true
            }
        }).then(messages => messages.reverse());
    }

    async getMessagesCursor(ticketId: string, companyId: string, cursor?: string, limit: number = 50) {
        await this.validateTicketOwnership(ticketId, companyId);
        return this.prisma.message.findMany({
            where: { ticketId },
            take: Number(limit),
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { sentAt: 'desc' },
            include: {
                quotedMessage: true
            }
        });
    }

    async getMacros(companyId: string) {
        return this.prisma.quickReply.findMany({
            where: { companyId },
            orderBy: { shortcut: 'asc' }
        });
    }

    async createMacro(companyId: string, data: { title: string, content: string }) {
        return this.prisma.quickReply.create({
            data: {
                shortcut: data.title,
                content: data.content,
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
