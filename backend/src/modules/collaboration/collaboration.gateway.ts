import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CollaborationService } from './collaboration.service';

const COLLAB_WS_ORIGINS: string[] = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];

@WebSocketGateway({
    cors: {
        origin: COLLAB_WS_ORIGINS,
        credentials: true,
    },
    namespace: 'collab',
})
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(CollaborationGateway.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly collabService: CollaborationService
    ) { }

    async handleConnection(client: Socket) {
        try {
            const token = client.handshake.auth.token || client.handshake.headers.authorization;
            if (!token) {
                client.disconnect();
                return;
            }

            const payload = this.jwtService.verify(token.replace('Bearer ', ''));
            // Padronizando no socket data
            client.data.user = { ...payload, id: payload.sub };

            // Sala privada do usuário
            client.join(`user:${payload.sub}`);

            // Sala da empresa
            if (payload.companyId) {
                client.join(`company:${payload.companyId}`);

                // Atualizar Status para ONLINE no Banco
                await this.collabService.updateStatus(payload.sub, 'ONLINE');
                
                this.server.to(`company:${payload.companyId}`).emit('presenceUpdate', {
                    userId: payload.sub,
                    status: 'ONLINE'
                });
            }

            this.logger.log(`Collab conectado: ${client.id} (User: ${payload.sub})`);
        } catch (error) {
            this.logger.error(`Erro na conexão Collab: ${error.message}`);
            client.disconnect();
        }
    }

    async handleDisconnect(client: Socket) {
        const user = client.data.user;
        if (user && user.companyId) {
            // Em cenários de alta disponibilidade, você pode querer um delay antes de marcar OFFLINE
            await this.collabService.updateStatus(user.sub, 'OFFLINE');
            this.server.to(`company:${user.companyId}`).emit('presenceUpdate', {
                userId: user.sub,
                status: 'OFFLINE'
            });
        }
        this.logger.log(`Collab desconectado: ${client.id}`);
    }

    @SubscribeMessage('joinChat')
    async handleJoinChat(
        @ConnectedSocket() client: Socket,
        @MessageBody() chatId: string,
    ) {
        client.join(`internal-chat:${chatId}`);
        this.logger.log(`Cliente ${client.id} entrou no chat interno: ${chatId}`);
        return { event: 'joined', data: chatId };
    }

    @SubscribeMessage('leaveChat')
    handleLeaveChat(@ConnectedSocket() client: Socket, @MessageBody() chatId: string) {
        client.leave(`internal-chat:${chatId}`);
        this.logger.log(`Cliente ${client.id} saiu do chat interno: ${chatId}`);
        return { event: 'left', data: chatId };
    }

    @SubscribeMessage('sendInternalMessage')
    async handleInternalMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { 
            chatId: string, 
            content: string, 
            type?: any, 
            replyToId?: string,
            threadId?: string
        }
    ) {
        const user = client.data.user;
        
        const message = await this.collabService.sendInternalMessage({
            chatId: data.chatId,
            senderUserId: user.sub,
            content: data.content,
            type: data.type,
            replyToId: data.replyToId,
            threadId: data.threadId
        });

        // Emitir para todos na sala do chat interna
        this.server.to(`internal-chat:${data.chatId}`).emit('newInternalMessage', message);

        // Notificar globalmente na empresa para badges de unread
        this.server.to(`company:${user.companyId}`).emit('internalActivity', {
            chatId: data.chatId,
            senderName: user.name,
            content: data.content.substring(0, 30) + '...'
        });

        // --- Verificação de Menção a IA ---
        // Se a mensagem contém @nomedoagente, disparar lógica de IA (implementação futura no service)
    }

    @SubscribeMessage('updateStatus')
    async handleUpdateStatus(
        @ConnectedSocket() client: Socket,
        @MessageBody() status: string
    ) {
        const user = client.data.user;
        if (user && user.companyId) {
            await this.collabService.updateStatus(user.sub, status);
            this.server.to(`company:${user.companyId}`).emit('presenceUpdate', {
                userId: user.sub,
                status
            });
        }
    }

    @SubscribeMessage('internalTyping')
    handleTyping(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { chatId: string, isTyping: boolean }
    ) {
        const user = client.data.user;
        client.to(`internal-chat:${data.chatId}`).emit('internalTyping', {
            chatId: data.chatId,
            userId: user.sub,
            userName: user.name,
            isTyping: data.isTyping
        });
    }

    @SubscribeMessage('addReaction')
    async handleAddReaction(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { messageId: string, emoji: string, chatId: string }
    ) {
        const user = client.data.user;
        // Notifica a sala sobre a nova reação (persistência pode ser feita via REST ou Service aqui)
        this.server.to(`internal-chat:${data.chatId}`).emit('reactionAdded', {
            messageId: data.messageId,
            emoji: data.emoji,
            userId: user.sub
        });
    }

    @SubscribeMessage('editInternalMessage')
    async handleEditMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { messageId: string, content: string, chatId: string }
    ) {
        const user = client.data.user;
        const message = await this.collabService.editInternalMessage(user.sub, data.messageId, data.content);
        this.server.to(`internal-chat:${data.chatId}`).emit('internalMessageUpdated', message);
    }

    @SubscribeMessage('markRead')
    async handleMarkRead(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { chatMemberId: string, messageId: string, chatId: string }
    ) {
        await this.collabService.markAsRead(data.chatMemberId, data.messageId);
        this.server.to(`internal-chat:${data.chatId}`).emit('messageStatusUpdate', {
            messageId: data.messageId,
            status: 'READ',
            userId: client.data.user.id // Usando id em vez de sub para consistência
        });
    }

    @SubscribeMessage('markDelivered')
    async handleMarkDelivered(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { messageId: string, chatId: string }
    ) {
        await this.collabService.markAsDelivered(data.messageId);
        this.server.to(`internal-chat:${data.chatId}`).emit('messageStatusUpdate', {
            messageId: data.messageId,
            status: 'DELIVERED'
        });
    }
}
