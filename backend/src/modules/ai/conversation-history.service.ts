import { Injectable, Logger } from '@nestjs/common';
import type { PrismaService } from '../../database/prisma.service';

/**
 * Serviço de histórico de conversas para o Playground de IA.
 * Armazena e recupera conversas do usuário com agentes de IA.
 */
@Injectable()
export class ConversationHistoryService {
    private readonly logger = new Logger(ConversationHistoryService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Cria uma nova conversa
     */
    async createConversation(
        companyId: string,
        userId: string,
        agentId: string,
        title?: string
    ) {
        const conversation = await (this.prisma as any).conversation.create({
            data: {
                companyId,
                userId,
                agentId,
                title: title || `Conversa ${new Date().toLocaleDateString()}`,
            },
            include: {
                agent: true,
            },
        });

        this.logger.log(`Conversa criada: ${conversation.id} para usuário ${userId}`);
        return conversation;
    }

    /**
     * Lista todas as conversas de um usuário
     */
    async getUserConversations(companyId: string, userId: string, limit: number = 20) {
        const conversations = await (this.prisma as any).conversation.findMany({
            where: {
                companyId,
                userId,
            },
            include: {
                agent: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                _count: {
                    select: { messages: true },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        return conversations;
    }

    /**
     * Obtém detalhes de uma conversa com mensagens
     */
    async getConversationDetails(
        companyId: string,
        userId: string,
        conversationId: string,
        limit: number = 50
    ) {
        const conversation = await (this.prisma as any).conversation.findFirst({
            where: {
                id: conversationId,
                companyId,
                userId,
            },
            include: {
                agent: true,
                messages: {
                    orderBy: { createdAt: 'asc' },
                    take: limit,
                },
            },
        });

        if (!conversation) {
            throw new Error('Conversa não encontrada');
        }

        return conversation;
    }

    /**
     * Adiciona uma mensagem a uma conversa
     */
    async addMessage(
        companyId: string,
        userId: string,
        conversationId: string,
        role: 'user' | 'assistant',
        content: string,
        metadata?: any
    ) {
        const message = await (this.prisma as any).conversationMessage.create({
            data: {
                conversationId,
                role,
                content,
                metadata,
            },
        });

        // Atualiza título da conversa se for primeira mensagem do usuário
        const firstUserMessage = await (this.prisma as any).conversationMessage.findFirst({
            where: {
                conversationId,
                role: 'user',
            },
            orderBy: { createdAt: 'asc' },
        });

        if (firstUserMessage?.id === message.id) {
            await (this.prisma as any).conversation.update({
                where: { id: conversationId },
                data: {
                    title: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
                },
            });
        }

        return message;
    }

    /**
     * Deleta uma conversa
     */
    async deleteConversation(companyId: string, userId: string, conversationId: string) {
        // Deleta mensagens primeiro
        await (this.prisma as any).conversationMessage.deleteMany({
            where: {
                conversationId,
            },
        });

        // Deleta conversa
        const result = await (this.prisma as any).conversation.deleteMany({
            where: {
                id: conversationId,
                companyId,
                userId,
            },
        });

        this.logger.log(`Conversa deletada: ${conversationId}, mensagens afetadas: ${result.count}`);
        return result;
    }

    /**
     * Deleta todas as mensagens de uma conversa
     */
    async clearConversationMessages(companyId: string, userId: string, conversationId: string) {
        const result = await (this.prisma as any).conversationMessage.deleteMany({
            where: {
                conversationId,
            },
        });

        this.logger.log(`Mensagens limpas: ${result.count} para conversa ${conversationId}`);
        return result;
    }

    /**
     * Obtém estatísticas de uso
     */
    async getUsageStats(companyId: string, userId: string) {
        const totalConversations = await (this.prisma as any).conversation.count({
            where: { companyId, userId },
        });

        const totalMessages = await (this.prisma as any).conversationMessage.count({
            where: {
                conversation: { companyId, userId },
            },
        });

        const conversationsByAgent = await (this.prisma as any).conversation.groupBy({
            by: ['agentId'],
            where: { companyId, userId },
            _count: true,
        });

        return {
            totalConversations,
            totalMessages,
            conversationsByAgent,
        };
    }

    /**
     * Renomeia uma conversa
     */
    async renameConversation(
        companyId: string,
        userId: string,
        conversationId: string,
        title: string
    ) {
        const conversation = await (this.prisma as any).conversation.findFirst({
            where: {
                id: conversationId,
                companyId,
                userId,
            },
        });

        if (!conversation) {
            throw new Error('Conversa não encontrada');
        }

        return (this.prisma as any).conversation.update({
            where: { id: conversationId },
            data: { title },
        });
    }
}