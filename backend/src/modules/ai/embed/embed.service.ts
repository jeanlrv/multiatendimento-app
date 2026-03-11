import { Injectable, Logger, NotFoundException, BadRequestException, HttpException, HttpStatus, OnModuleDestroy } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../../../database/prisma.service';
import { AIService } from '../ai.service';

@Injectable()
export class EmbedService implements OnModuleDestroy {
    private readonly logger = new Logger(EmbedService.name);
    // Rate limiter em memória: Map<sessionId, { count: number, resetAt: number }>
    // Simulando 20 mensagens por 10 min
    private rateLimiter: Map<string, { count: number, resetAt: number }> = new Map();
    private cleanupInterval: NodeJS.Timeout;

    constructor(
        private prisma: PrismaService,
        private aiService: AIService,
    ) {
        // Limpeza periódica de entradas expiradas (a cada 5 minutos)
        this.cleanupInterval = setInterval(() => this.cleanupExpiredEntries(), 5 * 60 * 1000);
    }

    onModuleDestroy() {
        clearInterval(this.cleanupInterval);
    }

    private cleanupExpiredEntries() {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, value] of this.rateLimiter) {
            if (now > value.resetAt) {
                this.rateLimiter.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            this.logger.debug(`Rate limiter: ${cleaned} entradas expiradas removidas, ${this.rateLimiter.size} ativas`);
        }
    }

    private checkRateLimit(sessionId: string, maxLimit: number = 20) {
        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000;

        let limitData = this.rateLimiter.get(sessionId);

        if (!limitData || now > limitData.resetAt) {
            // Reset ou primeira requisição
            limitData = { count: 1, resetAt: now + tenMinutes };
            this.rateLimiter.set(sessionId, limitData);
            return;
        }

        if (limitData.count >= maxLimit) {
            throw new HttpException('Acesso limitado. Tente novamente mais tarde.', HttpStatus.TOO_MANY_REQUESTS);
        }

        limitData.count += 1;
        this.rateLimiter.set(sessionId, limitData);
    }

    private validateDomain(origin: string, allowedDomains: string[]) {
        if (!allowedDomains || allowedDomains.length === 0) return true; // Aberto se array vazio
        if (!origin) return false;

        try {
            const originUrl = new URL(origin);
            const hostname = originUrl.hostname;

            // Checar se o hostname está nos permitidos (permite subdomínios se necessário futuramente, por enquanto check exato)
            return allowedDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
        } catch (e) {
            return false;
        }
    }

    async getPublicConfig(embedId: string, origin?: string) {
        const agent = await (this.prisma as any).aIAgent.findUnique({
            where: { embedId },
            select: {
                id: true,
                isActive: true,
                companyId: true,
                embedEnabled: true,
                embedBrandColor: true,
                embedBrandLogo: true,
                embedAgentName: true,
                embedWelcomeMsg: true,
                embedPlaceholder: true,
                embedPosition: true,
                embedAllowedDomains: true,
                name: true
            }
        });

        if (!agent || !agent.isActive || !agent.embedEnabled) {
            throw new NotFoundException('Agente de IA não encontrado ou inativo.');
        }

        if (origin && agent.embedAllowedDomains?.length > 0 && !this.validateDomain(origin, agent.embedAllowedDomains)) {
            throw new HttpException('Domínio não autorizado.', HttpStatus.FORBIDDEN);
        }

        return {
            embedId,
            brandColor: agent.embedBrandColor,
            brandLogo: agent.embedBrandLogo,
            agentName: agent.embedAgentName || agent.name,
            welcomeMsg: agent.embedWelcomeMsg,
            placeholder: agent.embedPlaceholder,
            position: agent.embedPosition,
        };
    }

    async chat(embedId: string, sessionId: string, message: string, origin?: string) {
        if (!sessionId) {
            throw new BadRequestException('SessionId é obrigatório.');
        }

        const agent = await (this.prisma as any).aIAgent.findUnique({
            where: { embedId },
            select: { id: true, companyId: true, embedEnabled: true, isActive: true, embedRateLimit: true, embedAllowedDomains: true }
        });

        if (!agent || !agent.isActive || !agent.embedEnabled) {
            throw new NotFoundException('Agente de IA indisponível.');
        }

        if (origin && agent.embedAllowedDomains?.length > 0 && !this.validateDomain(origin, agent.embedAllowedDomains)) {
            throw new HttpException('Domínio não autorizado.', HttpStatus.FORBIDDEN);
        }

        // Apply Rate Limit
        this.checkRateLimit(sessionId, agent.embedRateLimit);

        try {
            // Fetch or Create Session
            let session = await (this.prisma as any).embedChatSession.findUnique({
                where: { embedId_sessionId: { embedId, sessionId } }
            });

            if (!session) {
                session = await (this.prisma as any).embedChatSession.create({
                    data: { embedId, sessionId, messages: [] }
                });
            }

            const currentMessages: any[] = Array.isArray(session.messages) ? [...session.messages] : [];
            const historyForLLM = currentMessages.map((m: any) => ({ role: m.role, content: m.content }));
            currentMessages.push({ role: 'user', content: message, ts: Date.now() });

            // Chamar AI nativa
            const response = await this.aiService.chat(
                agent.companyId,
                agent.id,
                message,
                historyForLLM
            );

            currentMessages.push({ role: 'assistant', content: response, ts: Date.now() });

            // Salvar sessão (fire-and-forget — não bloqueia a resposta se falhar)
            (this.prisma as any).embedChatSession.update({
                where: { id: session.id },
                data: { messages: currentMessages }
            }).catch((e: Error) => this.logger.warn(`[Embed] Falha ao salvar sessão: ${e.message}`));

            return { response };

        } catch (error) {
            this.logger.error(`Erro no chat embed (${embedId}): ${error?.message}`);
            // Preserva status code original de HttpException (ex: 400 de provider não configurado)
            if (error instanceof HttpException) throw error;
            // Erros de Prisma ou outros: retorna 500 com mensagem legível
            throw new HttpException(
                error?.message || 'Erro interno ao processar mensagem.',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /** Versão streaming do chat: retorna Observable de tokens + salva sessão no DB ao concluir. */
    async streamChat(embedId: string, sessionId: string, message: string, origin?: string): Promise<Observable<any>> {
        if (!sessionId) throw new BadRequestException('SessionId é obrigatório.');

        const agent = await (this.prisma as any).aIAgent.findUnique({
            where: { embedId },
            select: { id: true, companyId: true, embedEnabled: true, isActive: true, embedRateLimit: true, embedAllowedDomains: true }
        });

        if (!agent || !agent.isActive || !agent.embedEnabled) {
            throw new NotFoundException('Agente de IA indisponível.');
        }

        if (origin && agent.embedAllowedDomains?.length > 0 && !this.validateDomain(origin, agent.embedAllowedDomains)) {
            throw new HttpException('Domínio não autorizado.', HttpStatus.FORBIDDEN);
        }

        this.checkRateLimit(sessionId, agent.embedRateLimit);

        let session = await (this.prisma as any).embedChatSession.findUnique({
            where: { embedId_sessionId: { embedId, sessionId } }
        });

        if (!session) {
            session = await (this.prisma as any).embedChatSession.create({
                data: { embedId, sessionId, messages: [] }
            });
        }

        const currentMessages: any[] = Array.isArray(session.messages) ? [...session.messages] : [];
        const historyForLLM = currentMessages.map((m: any) => ({ role: m.role, content: m.content }));
        currentMessages.push({ role: 'user', content: message, ts: Date.now() });

        const agentObservable = this.aiService.streamChat(agent.companyId, agent.id, message, historyForLLM);
        const sessionDbId = session.id;
        const prisma = this.prisma;
        const logger = this.logger;
        let fullResponse = '';

        return new Observable(observer => {
            agentObservable.subscribe({
                next: (event: any) => {
                    if (event.data?.type === 'chunk') fullResponse += event.data.content;
                    observer.next(event);
                },
                error: (err: any) => observer.error(err),
                complete: () => {
                    const msgs = [...currentMessages, { role: 'assistant', content: fullResponse, ts: Date.now() }];
                    (prisma as any).embedChatSession.update({
                        where: { id: sessionDbId },
                        data: { messages: msgs },
                    }).catch((e: any) => logger.error(`Erro ao salvar sessão embed stream: ${e.message}`));
                    observer.complete();
                },
            });
        });
    }

    async getHistory(embedId: string, sessionId: string, origin?: string) {
        const agent = await (this.prisma as any).aIAgent.findUnique({
            where: { embedId },
            select: { embedEnabled: true, embedAllowedDomains: true, isActive: true }
        });

        if (!agent || !agent.isActive || !agent.embedEnabled) {
            throw new NotFoundException('Agente de IA indisponível.');
        }

        if (origin && agent.embedAllowedDomains?.length > 0 && !this.validateDomain(origin, agent.embedAllowedDomains)) {
            throw new HttpException('Domínio não autorizado.', HttpStatus.FORBIDDEN);
        }

        const session = await (this.prisma as any).embedChatSession.findUnique({
            where: { embedId_sessionId: { embedId, sessionId } },
            select: { messages: true }
        });

        if (!session) return { messages: [] };

        return { messages: session.messages };
    }

    async chatWithAttachment(
        embedId: string,
        sessionId: string,
        message: string,
        file: Express.Multer.File,
        origin?: string,
    ): Promise<{ response: string }> {
        if (!sessionId) throw new BadRequestException('SessionId é obrigatório.');

        const agent = await (this.prisma as any).aIAgent.findUnique({
            where: { embedId },
            select: { id: true, companyId: true, embedEnabled: true, isActive: true, embedRateLimit: true, embedAllowedDomains: true }
        });

        if (!agent || !agent.isActive || !agent.embedEnabled) {
            throw new NotFoundException('Agente de IA indisponível.');
        }

        if (origin && agent.embedAllowedDomains?.length > 0 && !this.validateDomain(origin, agent.embedAllowedDomains)) {
            throw new HttpException('Domínio não autorizado.', HttpStatus.FORBIDDEN);
        }

        this.checkRateLimit(sessionId, agent.embedRateLimit);

        try {
            let session = await (this.prisma as any).embedChatSession.findUnique({
                where: { embedId_sessionId: { embedId, sessionId } }
            });
            if (!session) {
                session = await (this.prisma as any).embedChatSession.create({
                    data: { embedId, sessionId, messages: [] }
                });
            }

            const currentMessages: any[] = Array.isArray(session.messages) ? [...session.messages] : [];
            const historyForLLM = currentMessages.map((m: any) => ({ role: m.role, content: m.content }));

            // Salva a mensagem do usuário com indicador de arquivo
            currentMessages.push({ role: 'user', content: `📎 ${file.originalname}\n${message}`, ts: Date.now() });

            const response = await this.aiService.chatWithAttachment(agent.companyId, agent.id, message, file, historyForLLM);

            currentMessages.push({ role: 'assistant', content: response, ts: Date.now() });

            // Fire-and-forget
            (this.prisma as any).embedChatSession.update({
                where: { id: session.id },
                data: { messages: currentMessages },
            }).catch((e: Error) => this.logger.warn(`[Embed] Falha ao salvar sessão: ${e.message}`));

            return { response };
        } catch (error: any) {
            this.logger.error(`Erro no chat embed com anexo (${embedId}): ${error?.message}`);
            if (error instanceof HttpException) throw error;
            throw new HttpException(error?.message || 'Erro interno ao processar mensagem.', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
