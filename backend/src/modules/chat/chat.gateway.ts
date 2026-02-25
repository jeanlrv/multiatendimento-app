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
import { Logger, UseGuards, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { PrismaService } from '../../database/prisma.service';

@WebSocketGateway({
    cors: {
        origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
        credentials: true,
    },
    namespace: 'chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ChatGateway.name);
    // Rate limiting: controla o tempo do último evento por client+evento
    private readonly rateLimitMap = new Map<string, number>();
    private readonly RATE_LIMIT_MS = 2000; // mínimo 2s entre eventos de typing

    constructor(
        private readonly jwtService: JwtService,
        private readonly prisma: PrismaService,
    ) { }

    async onModuleInit() {
        const redisUrl = process.env.REDIS_URL;
        const redisHost = process.env.REDISHOST || process.env.REDIS_HOST || 'localhost';
        const redisPort = parseInt(process.env.REDISPORT || process.env.REDIS_PORT || '6379', 10);
        const redisPassword = process.env.REDISPASSWORD || process.env.REDIS_PASSWORD || undefined;

        try {
            const redisOptions = {
                retryStrategy: (times: number) => Math.min(times * 50, 2000),
            };

            const pubClient = redisUrl
                ? new Redis(redisUrl, redisOptions)
                : new Redis({
                    host: redisHost,
                    port: redisPort,
                    ...(redisPassword && { password: redisPassword }),
                    ...redisOptions,
                });

            const subClient = pubClient.duplicate();

            if (this.server && typeof this.server.adapter === 'function') {
                this.server.adapter(createAdapter(pubClient, subClient));
                this.logger.log('Redis Adapter configurado para o WebSocket gateway');
            } else {
                this.logger.warn('Socket.io server não inicializado ou adapter indisponível no boot');
            }
        } catch (error) {
            this.logger.error('Erro ao configurar Redis Adapter:', error.message);
        }
    }

    async handleConnection(client: Socket) {
        try {
            const token = client.handshake.auth.token || client.handshake.headers.authorization;
            if (!token) {
                this.logger.warn(`Cliente tentou conectar sem token: ${client.id}`);
                client.disconnect();
                return;
            }

            const payload = this.jwtService.verify(token.replace('Bearer ', ''));
            client.data.user = payload;

            // Entrar na sala do usuário para notificações privadas
            client.join(`user:${payload.sub}`);

            // Entrar na sala da empresa para notificações globais
            if (payload.companyId) {
                client.join(`company:${payload.companyId}`);
                this.logger.log(`Cliente ${client.id} entrou na sala da empresa: ${payload.companyId}`);
            }

            this.logger.log(`Cliente conectado: ${client.id} (User: ${payload.sub})`);
        } catch (error) {
            this.logger.error(`Erro na conexão WebSocket: ${error.message}`);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        // Limpar entradas de rate limit do cliente ao desconectar
        for (const key of this.rateLimitMap.keys()) {
            if (key.startsWith(client.id)) this.rateLimitMap.delete(key);
        }
        this.logger.log(`Cliente desconectado: ${client.id}`);
    }

    private isRateLimited(clientId: string, event: string): boolean {
        const key = `${clientId}:${event}`;
        const last = this.rateLimitMap.get(key) ?? 0;
        const now = Date.now();
        if (now - last < this.RATE_LIMIT_MS) return true;
        this.rateLimitMap.set(key, now);
        return false;
    }

    @SubscribeMessage('joinTicket')
    async handleJoinTicket(
        @ConnectedSocket() client: Socket,
        @MessageBody() ticketId: string,
    ) {
        const user = client.data.user;
        if (!user || !user.companyId) {
            client.emit('error', 'Usuário não autenticado');
            return;
        }

        const departamentosPermitidos = user.departments?.map((d: any) => d.id) || [];

        // Validar se o ticket pertence à empresa do usuário E ao departamento permitido
        const ticketExists = await (this.prisma as any).ticket.findFirst({
            where: {
                id: ticketId,
                companyId: user.companyId,
                ...(departamentosPermitidos.length > 0 && { departmentId: { in: departamentosPermitidos } }),
            }
        });

        if (!ticketExists) {
            this.logger.warn(`Tentativa de acesso não autorizado: User ${user.sub} -> Ticket ${ticketId}`);
            client.emit('error', 'Acesso negado ao ticket ou departamento');
            return;
        }

        client.join(`ticket:${ticketId}`);
        this.logger.log(`Cliente ${client.id} entrou na sala do ticket: ${ticketId}`);
        return { event: 'joined', data: ticketId };
    }

    @SubscribeMessage('leaveTicket')
    handleLeaveTicket(@ConnectedSocket() client: Socket, @MessageBody() ticketId: string) {
        client.leave(`ticket:${ticketId}`);
        this.logger.log(`Cliente ${client.id} saiu da sala do ticket: ${ticketId}`);
        return { event: 'left', data: ticketId };
    }

    // Método para emitir mensagens para uma sala específica e para a empresa
    emitNewMessage(companyId: string, ticketId: string, message: any) {
        this.server.to(`ticket:${ticketId}`).emit('newMessage', message);
        this.server.to(`company:${companyId}`).emit('globalMessage', { ticketId, message });
    }

    // Método para emitir sugestões de IA
    emitAISuggestion(ticketId: string, suggestion: string) {
        this.server.to(`ticket:${ticketId}`).emit('aiSuggestion', { suggestion });
    }

    // Método para emitir atualizações de sentimento (Handoff Emocional)
    emitSentimentUpdate(ticketId: string, evaluation: any) {
        this.server.to(`ticket:${ticketId}`).emit('sentimentUpdate', evaluation);
    }

    @SubscribeMessage('startTyping')
    handleStartTyping(@ConnectedSocket() client: Socket, @MessageBody() data: { ticketId: string }) {
        if (this.isRateLimited(client.id, 'typing')) return;
        const { ticketId } = data;
        client.to(`ticket:${ticketId}`).emit('typing', {
            ticketId,
            userId: client.data.user.sub,
            userName: client.data.user.name,
            isTyping: true
        });
    }

    @SubscribeMessage('stopTyping')
    handleStopTyping(@ConnectedSocket() client: Socket, @MessageBody() data: { ticketId: string }) {
        if (this.isRateLimited(client.id, 'stopTyping')) return;
        const { ticketId } = data;
        client.to(`ticket:${ticketId}`).emit('typing', {
            ticketId,
            userId: client.data.user.sub,
            isTyping: false
        });
    }

    // Método para emitir presença do contato via Webhook
    emitPresenceUpdate(ticketId: string, isTyping: boolean, contactName?: string) {
        this.server.to(`ticket:${ticketId}`).emit('typing', {
            ticketId,
            userId: 'external',
            userName: contactName || 'Contato',
            isTyping
        });
    }

    // Método para emitir atualização de status de mensagem
    emitMessageStatusUpdate(ticketId: string, messageId: string, status: string) {
        this.server.to(`ticket:${ticketId}`).emit('messageStatusUpdate', {
            messageId,
            status
        });
    }

    // Método para emitir menção direta a um usuário
    emitMention(companyId: string, userId: string, data: { ticketId: string, messageId: string, mentionContent: string }) {
        // Notifica apenas as conexões do usuário específico através de uma sala privada
        this.server.to(`user:${userId}`).emit('mention', data);

        // Também notifica na sala da empresa para outros supervisores verem (opcional)
        this.server.to(`company:${companyId}`).emit('globalMention', data);
    }
}
