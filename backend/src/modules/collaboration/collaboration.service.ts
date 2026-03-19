import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InternalChatType, MessageType } from '@prisma/client';
import { AIChatService } from '../ai/ai-chat.service';

@Injectable()
export class CollaborationService {
    private readonly logger = new Logger(CollaborationService.name);

    constructor(
        private prisma: PrismaService,
        @Inject(forwardRef(() => AIChatService))
        private aiChatService: AIChatService,
    ) { }

    // --- Presença e Status ---

    async updateStatus(userId: string, status: string) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { chatStatus: status }
        });
    }

    async toggleSound(userId: string, enabled: boolean) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { chatSoundEnabled: enabled }
        });
    }

    async getAllPresence(companyId: string) {
        return this.prisma.user.findMany({
            where: { companyId, isActive: true },
            select: { 
                id: true, 
                name: true, 
                avatar: true, 
                chatStatus: true 
            }
        });
    }

    // --- Gerenciamento de Canais e Salas ---

    async getOrCreateDirectChat(companyId: string, participant1: { userId?: string, aiId?: string }, participant2: { userId?: string, aiId?: string }) {
        // Encontrar chat DIRECT entre os dois (Polimórfico)
        const existingChat = await this.prisma.internalChat.findFirst({
            where: {
                companyId,
                type: InternalChatType.DIRECT,
                AND: [
                    { members: { some: participant1.userId ? { userId: participant1.userId } : { aiAgentId: participant1.aiId } } },
                    { members: { some: participant2.userId ? { userId: participant2.userId } : { aiAgentId: participant2.aiId } } }
                ]
            },
            include: { members: true }
        });

        if (existingChat && existingChat.members.length === 2) {
            return existingChat;
        }

        // Criar novo chat direct
        return this.prisma.internalChat.create({
            data: {
                companyId,
                type: InternalChatType.DIRECT,
                members: {
                    create: [
                        participant1.userId ? { userId: participant1.userId, role: 'ADMIN' } : { aiAgentId: participant1.aiId, role: 'AI_AGENT' },
                        participant2.userId ? { userId: participant2.userId, role: 'ADMIN' } : { aiAgentId: participant2.aiId, role: 'AI_AGENT' }
                    ]
                }
            },
            include: { members: true }
        });
    }

    async createChatRoom(companyId: string, data: { name: string, description?: string, type: InternalChatType, creatorId: string, memberIds: string[], aiAgentIds?: string[] }) {
        return this.prisma.internalChat.create({
            data: {
                companyId,
                name: data.name,
                description: data.description,
                type: data.type,
                members: {
                    create: [
                        { userId: data.creatorId, role: 'OWNER' },
                        ...data.memberIds.map(id => ({ userId: id, role: 'MEMBER' })),
                        ...(data.aiAgentIds || []).map(id => ({ aiAgentId: id, role: 'AI_AGENT' }))
                    ]
                }
            },
            include: { members: { include: { user: true, aiAgent: true } } }
        });
    }

    // --- Mensageria ---

    async sendInternalMessage(data: { 
        chatId: string, 
        senderUserId?: string, 
        senderAiAgentId?: string, 
        content: string, 
        type?: MessageType,
        replyToId?: string,
        threadId?: string
    }) {
        const message = await this.prisma.internalChatMessage.create({
            data: {
                chatId: data.chatId,
                senderUserId: data.senderUserId,
                senderAiAgentId: data.senderAiAgentId,
                content: data.content,
                type: data.type || 'TEXT',
                replyToId: data.replyToId,
                threadId: data.threadId,
                sentAt: new Date()
            },
            include: { 
                senderUser: { select: { id: true, name: true, avatar: true } },
                senderAiAgent: { select: { id: true, name: true, avatar: true } }
            }
        });

        // Atualiza o updatedAt do chat para subir na lista
        await this.prisma.internalChat.update({
            where: { id: data.chatId },
            data: { updatedAt: new Date() }
        });

        // --- Processamento de Menções (User -> IA) ---
        setImmediate(() => this.handleAiMentions(message));

        return message;
    }

    async handleAiMentions(message: any) {
        const { content, chatId, chat } = await this.prisma.internalChatMessage.findUnique({
            where: { id: message.id },
            include: { chat: true }
        }) as any;

        // Procura por @menções no formato @NomeDoAgente
        const mentionRegex = /@(\w+)/g;
        let match;
        while ((match = mentionRegex.exec(content)) !== null) {
            const agentName = match[1];
            const agent = await this.prisma.aIAgent.findFirst({
                where: { 
                    name: { contains: agentName, mode: 'insensitive' },
                    allowInInternalChat: true,
                    companyId: chat.companyId
                }
            });

            if (agent) {
                this.logger.log(`[AI-ChatOps] Agente ${agent.name} mencionado no chat ${chatId}`);

                // Busca histórico recente para contexto
                const history = await this.getHistory(chatId, { limit: 10 });
                const aiHistory: any[] = history.map(h => ({
                    role: h.senderAiAgentId ? 'assistant' : 'user',
                    content: h.content
                }));

                try {
                    const aiResponse = await this.aiChatService.chat(
                        chat.companyId,
                        agent.id,
                        content.replace(`@${agentName}`, '').trim(),
                        aiHistory
                    );

                    // Envia a resposta da IA
                    await this.sendInternalMessage({
                        chatId,
                        senderAiAgentId: agent.id,
                        content: aiResponse,
                        type: 'TEXT',
                        threadId: message.threadId || message.id // Responde na thread se existir, ou cria uma nova
                    });
                } catch (error) {
                    this.logger.error(`[AI-ChatOps] Erro na resposta da IA: ${error.message}`);
                }
            }
        }
    }

    async getHistory(chatId: string, options: { limit?: number, before?: Date, threadId?: string } = {}) {
        return this.prisma.internalChatMessage.findMany({
            where: { 
                chatId,
                threadId: options.threadId || null,
                sentAt: options.before ? { lt: options.before } : undefined
            },
            orderBy: { sentAt: 'desc' },
            take: options.limit || 50,
            include: { 
                senderUser: { select: { id: true, name: true, avatar: true } },
                senderAiAgent: { select: { id: true, name: true, avatar: true } },
                reactions: true,
                attachments: true
            }
        }).then(msgs => msgs.reverse());
    }

    // --- Filtros e Busca de Histórico (Novo Requisito) ---

    async searchHistory(companyId: string, filters: { 
        senderId?: string, 
        chatId?: string,
        startDate?: Date, 
        endDate?: Date, 
        query?: string 
    }) {
        return this.prisma.internalChatMessage.findMany({
            where: {
                chat: { companyId },
                chatId: filters.chatId,
                senderUserId: filters.senderId,
                content: filters.query ? { contains: filters.query, mode: 'insensitive' } : undefined,
                sentAt: {
                    gte: filters.startDate,
                    lte: filters.endDate
                }
            },
            include: {
                chat: { select: { name: true, type: true } },
                senderUser: { select: { name: true, avatar: true } },
                senderAiAgent: { select: { name: true, avatar: true } }
            },
            orderBy: { sentAt: 'desc' }
        });
    }

    async getUserChats(userId: string, companyId: string) {
        return this.prisma.internalChat.findMany({
            where: {
                companyId,
                OR: [
                    { type: InternalChatType.CHANNEL }, // Canais são visíveis para todos da empresa? Ou só membros?
                    { members: { some: { userId } } }
                ]
            },
            include: {
                members: { 
                    include: { 
                        user: { select: { id: true, name: true, avatar: true, chatStatus: true } },
                        aiAgent: { select: { id: true, name: true, avatar: true } }
                    } 
                },
                messages: {
                    orderBy: { sentAt: 'desc' },
                    take: 1
                }
            },
            orderBy: { updatedAt: 'desc' }
        });
    }

    async markAsRead(chatMemberId: string, messageId: string) {
        // 1. Atualiza o membro do chat (cursor de leitura)
        await this.prisma.internalChatMember.update({
            where: { id: chatMemberId },
            data: { lastReadMessageId: messageId }
        });

        // 2. Atualiza a mensagem individual (recibo de leitura)
        const member = await this.prisma.internalChatMember.findUnique({
            where: { id: chatMemberId },
            select: { userId: true, aiAgentId: true }
        });

        if (member) {
            const message = await this.prisma.internalChatMessage.findUnique({
                where: { id: messageId },
                select: { readAt: true }
            });

            const currentReadAt = (message?.readAt as any[]) || [];
            const actorId = member.userId || member.aiAgentId;
            
            // Evita duplicatas
            if (!currentReadAt.find(r => r.id === actorId)) {
                currentReadAt.push({ id: actorId, timestamp: new Date() });
                await this.prisma.internalChatMessage.update({
                    where: { id: messageId },
                    data: { readAt: currentReadAt }
                });
            }
        }
    }

    async editInternalMessage(userId: string, messageId: string, content: string) {
        const message = await this.prisma.internalChatMessage.findFirst({
            where: { id: messageId, senderUserId: userId }
        });

        if (!message) throw new NotFoundException('Mensagem não encontrada ou permissão negada');

        return this.prisma.internalChatMessage.update({
            where: { id: messageId },
            data: { 
                content,
                isEdited: true,
                updatedAt: new Date()
            }
        });
    }

    async markAsDelivered(messageId: string) {
        return this.prisma.internalChatMessage.update({
            where: { id: messageId },
            data: { deliveredAt: new Date() }
        });
    }
}
