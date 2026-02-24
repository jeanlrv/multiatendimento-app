import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InternalChatType, MessageType } from '@prisma/client';

@Injectable()
export class CollaborationService {
    private readonly logger = new Logger(CollaborationService.name);
    private userPresence = new Map<string, { status: string, lastSeen: Date }>();

    constructor(private prisma: PrismaService) { }

    // --- Presença ---

    updatePresence(userId: string, status: string) {
        this.userPresence.set(userId, { status, lastSeen: new Date() });
    }

    getPresence(userId: string) {
        return this.userPresence.get(userId) || { status: 'OFFLINE', lastSeen: new Date() };
    }

    async getAllPresence(companyId: string) {
        // Busca apenas os usuários que pertencem a esta empresa — multi-tenancy obrigatório
        const companyUsers = await this.prisma.user.findMany({
            where: { companyId, isActive: true },
            select: { id: true, name: true, avatar: true }
        });

        const companyUserIds = new Set(companyUsers.map(u => u.id));

        return companyUsers.map(user => {
            const presence = this.userPresence.get(user.id) || { status: 'OFFLINE', lastSeen: new Date() };
            return {
                userId: user.id,
                name: user.name,
                avatar: user.avatar,
                ...presence,
            };
        });
    }

    // --- Chat Interno ---

    async getOrCreateDirectChat(companyId: string, user1Id: string, user2Id: string) {
        // Tenta encontrar um chat DIRECT entre os dois usuários
        const existingChat = await this.prisma.internalChat.findFirst({
            where: {
                companyId,
                type: InternalChatType.DIRECT,
                members: { every: { userId: { in: [user1Id, user2Id] } } }
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
                        { userId: user1Id, role: 'ADMIN' },
                        { userId: user2Id, role: 'ADMIN' }
                    ]
                }
            },
            include: { members: true }
        });
    }

    async createGroupChat(companyId: string, name: string, creatorId: string, memberIds: string[]) {
        return this.prisma.internalChat.create({
            data: {
                companyId,
                name,
                type: InternalChatType.GROUP,
                members: {
                    create: [
                        { userId: creatorId, role: 'ADMIN' },
                        ...memberIds.map(id => ({ userId: id, role: 'MEMBER' }))
                    ]
                }
            },
            include: { members: true }
        });
    }

    async sendInternalMessage(chatId: string, senderId: string, content: string, type: MessageType = 'TEXT', mediaUrl?: string) {
        return this.prisma.internalChatMessage.create({
            data: {
                chatId,
                senderId,
                content,
                type: type,
                mediaUrl,
                sentAt: new Date()
            },
            include: { sender: { select: { id: true, name: true, avatar: true } } }
        });
    }

    async getChatHistory(chatId: string, limit: number = 50) {
        return this.prisma.internalChatMessage.findMany({
            where: { chatId },
            orderBy: { sentAt: 'desc' },
            take: limit,
            include: { sender: { select: { id: true, name: true, avatar: true } } }
        }).then(msgs => msgs.reverse());
    }

    async getUserChats(userId: string, companyId: string) {
        return this.prisma.internalChat.findMany({
            where: {
                companyId,
                members: { some: { userId } }
            },
            include: {
                members: { include: { user: { select: { id: true, name: true, avatar: true } } } },
                messages: {
                    orderBy: { sentAt: 'desc' },
                    take: 1
                }
            },
            orderBy: { updatedAt: 'desc' }
        });
    }

    async markAsRead(chatId: string, userId: string) {
        const lastMessage = await this.prisma.internalChatMessage.findFirst({
            where: { chatId },
            orderBy: { sentAt: 'desc' }
        });

        if (!lastMessage) return;

        // Atualiza o JSON readAt
        const currentReadAt = (lastMessage.readAt as any) || {};
        currentReadAt[userId] = new Date().toISOString();

        await this.prisma.internalChatMessage.update({
            where: { id: lastMessage.id },
            data: { readAt: currentReadAt }
        });
    }
}
