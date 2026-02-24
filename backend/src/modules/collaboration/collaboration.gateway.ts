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

@WebSocketGateway({
    cors: {
        origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
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
            client.data.user = payload;

            // Sala privada do usuário
            client.join(`user:${payload.sub}`);

            // Sala da empresa
            if (payload.companyId) {
                client.join(`company:${payload.companyId}`);

                // Atualizar e Notificar Presença
                this.collabService.updatePresence(payload.sub, 'ONLINE');
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

    handleDisconnect(client: Socket) {
        const user = client.data.user;
        if (user && user.companyId) {
            this.collabService.updatePresence(user.sub, 'OFFLINE');
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
        @MessageBody() data: { chatId: string, content: string, type?: any, mediaUrl?: string }
    ) {
        const user = client.data.user;
        const message = await this.collabService.sendInternalMessage(
            data.chatId,
            user.sub,
            data.content,
            data.type,
            data.mediaUrl
        );

        // Emitir para todos na sala do chat interna
        this.server.to(`internal-chat:${data.chatId}`).emit('newInternalMessage', message);

        // Notificar novos chats/atividades globalmente na empresa (opcional para badges)
        this.server.to(`company:${user.companyId}`).emit('internalActivity', {
            chatId: data.chatId,
            senderName: user.name
        });
    }

    @SubscribeMessage('updateStatus')
    async handleUpdateStatus(
        @ConnectedSocket() client: Socket,
        @MessageBody() status: string
    ) {
        const user = client.data.user;
        if (user && user.companyId) {
            this.collabService.updatePresence(user.sub, status);
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
}
