import { Injectable, Logger, NotFoundException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AIService } from '../ai.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class EmbedService {
    private readonly logger = new Logger(EmbedService.name);
    // Rate limiter em memória: Map<sessionId, { count: number, resetAt: number }>
    // Simulando 20 mensagens por 10 min
    private rateLimiter: Map<string, { count: number, resetAt: number }> = new Map();

    constructor(
        private prisma: PrismaService,
        private aiService: AIService,
    ) { }

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

        if (origin && !this.validateDomain(origin, agent.embedAllowedDomains)) {
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

        if (origin && !this.validateDomain(origin, agent.embedAllowedDomains)) {
            throw new HttpException('Domínio não autorizado.', HttpStatus.FORBIDDEN);
        }

        // Apply Rate Limit
        this.checkRateLimit(sessionId, agent.embedRateLimit);

        // Fetch or Create Session
        let session = await (this.prisma as any).embedChatSession.findUnique({
            where: { embedId_sessionId: { embedId, sessionId } }
        });

        if (!session) {
            session = await (this.prisma as any).embedChatSession.create({
                data: {
                    embedId,
                    sessionId,
                    messages: []
                }
            });
        }

        let currentMessages = Array.isArray(session.messages) ? session.messages : [];

        // Formatar history para o formato esperado pelo AIService
        const historyForLLM = currentMessages.map((m: any) => ({
            role: m.role,
            content: m.content
        }));

        currentMessages.push({ role: 'user', content: message, ts: Date.now() });

        try {
            // Chamar AI nativa (usando id real do agente)
            const response = await this.aiService.chat(
                agent.companyId,
                agent.id,
                message,
                historyForLLM
            );

            currentMessages.push({ role: 'assistant', content: response, ts: Date.now() });

            // Atualizar banco
            await (this.prisma as any).embedChatSession.update({
                where: { id: session.id },
                data: { messages: currentMessages }
            });

            return { response };

        } catch (error) {
            this.logger.error(`Erro no chat embed (Agent ${agent.id}): ${error.message}`);
            throw new HttpException(error.message || 'Erro ao processar mensagem.', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getHistory(embedId: string, sessionId: string, origin?: string) {
        const agent = await (this.prisma as any).aIAgent.findUnique({
            where: { embedId },
            select: { embedEnabled: true, embedAllowedDomains: true, isActive: true }
        });

        if (!agent || !agent.isActive || !agent.embedEnabled) {
            throw new NotFoundException('Agente de IA indisponível.');
        }

        if (origin && !this.validateDomain(origin, agent.embedAllowedDomains)) {
            throw new HttpException('Domínio não autorizado.', HttpStatus.FORBIDDEN);
        }

        const session = await (this.prisma as any).embedChatSession.findUnique({
            where: { embedId_sessionId: { embedId, sessionId } },
            select: { messages: true }
        });

        if (!session) return { messages: [] };

        return { messages: session.messages };
    }
}
