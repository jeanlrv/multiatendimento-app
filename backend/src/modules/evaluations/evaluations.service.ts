import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { AIService } from '../ai/ai.service';
import { Sentiment } from '@prisma/client';
import { ChatGateway } from '../chat/chat.gateway';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class EvaluationsService {
    private readonly logger = new Logger(EvaluationsService.name);

    constructor(
        @Inject(PrismaService) private prisma: PrismaService,
        @Inject(AIService) private aiService: AIService,
        @Inject(ChatGateway) private chatGateway: ChatGateway,
        private eventEmitter: EventEmitter2
    ) { }

    async createManualEvaluation(companyId: string, data: CreateEvaluationDto) {
        return this.prisma.evaluation.update({
            where: { ticketId: data.ticketId },
            data: {
                customerRating: data.customerRating,
                customerFeedback: data.customerFeedback,
                companyId
            }
        });
    }

    async generateAISentimentAnalysis(companyId: string, ticketId: string) {
        // Evitar chamadas duplicadas à IA: reutilizar análise gerada nos últimos 2 minutos
        const recent = await this.prisma.evaluation.findUnique({ where: { ticketId } });
        if (recent?.aiSentiment && recent.createdAt > new Date(Date.now() - 2 * 60 * 1000)) {
            this.logger.debug(`Análise recente reutilizada para ticket ${ticketId}`);
            return recent;
        }

        const ticket = await this.prisma.ticket.findFirst({
            where: { id: ticketId, companyId },
            include: {
                department: true,
                messages: { orderBy: { sentAt: 'asc' } },
                evaluation: true,
            } as any
        });

        const dept = (ticket as any).department;
        if (!ticket || !dept?.aiAgentId || ticket.messages.length === 0) {
            this.logger.warn(`Não foi possível gerar análise para o ticket ${ticketId} na empresa ${companyId}: Agente ou mensagens ausentes.`);
            return null;
        }

        const conversationLines = ticket.messages
            .map((m: any) => `${m.fromMe ? 'Atendente' : 'Cliente'}: ${m.content}`)
            .join('\n');

        // Incluir nota CSAT do cliente no contexto se disponível
        const csatRating = (ticket as any).evaluation?.customerRating;
        const csatContext = csatRating
            ? `\n\n[Nota CSAT do cliente: ${csatRating}/5 — considere esta avaliação na análise do score final]`
            : '';

        const conversation = conversationLines + csatContext;

        const result = await this.aiService.analyzeSentiment(companyId, dept.aiAgentId, conversation);

        if (!result) return null;

        const evaluation = await this.prisma.evaluation.upsert({
            where: { ticketId },
            create: {
                ticketId,
                companyId,
                aiSentiment: result.sentiment as Sentiment,
                aiSentimentScore: result.score,
                aiJustification: result.justification,
                aiSummary: '',
            },
            update: {
                aiSentiment: result.sentiment as Sentiment,
                aiSentimentScore: result.score,
                aiJustification: result.justification,
            }
        });

        this.eventEmitter.emit('evaluation.created', {
            ticketId,
            companyId,
            aiSentiment: result.sentiment,
            aiSentimentScore: result.score,
            aiJustification: result.justification
        });

        this.chatGateway.emitSentimentUpdate(ticketId, evaluation);

        // Alerta sentimental: verificar threshold da empresa
        const company = await this.prisma.company.findUnique({ where: { id: companyId } });
        const threshold = (company as any)?.sentimentAlertThreshold ?? 5;
        if (result.score < threshold) {
            this.eventEmitter.emit('evaluation.negative_score', {
                ticketId,
                companyId,
                score: result.score,
                threshold,
                summary: result.justification,
            });
            this.logger.warn(`Alerta sentimental: ticket ${ticketId} score ${result.score} < ${threshold}`);
        }

        return evaluation;
    }

    async findAll(companyId: string) {
        return this.prisma.evaluation.findMany({
            where: { companyId },
            include: {
                ticket: {
                    select: {
                        id: true,
                        subject: true,
                        summary: true,
                        status: true,
                        resolvedAt: true,
                        closedAt: true,
                        contact: { select: { name: true, phoneNumber: true } },
                        department: { select: { name: true, emoji: true, color: true } },
                        assignedUser: { select: { name: true, avatar: true } },
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async findByTicket(companyId: string, ticketId: string) {
        return this.prisma.evaluation.findFirst({
            where: { ticketId, companyId }
        });
    }

    // ─── Métodos públicos (CSAT) ──────────────────────────────────────────────

    async getPublicTicketInfo(ticketId: string) {
        const ticket = await this.prisma.ticket.findUnique({
            where: { id: ticketId },
            select: {
                id: true,
                status: true,
                contact: { select: { name: true } },
                assignedUser: { select: { name: true, avatar: true } },
                department: { select: { name: true, emoji: true } },
                company: { select: { name: true, logoUrl: true } },
                evaluation: { select: { customerRating: true, customerFeedback: true } },
            }
        });
        return ticket;
    }

    async submitPublicEvaluation(ticketId: string, rating: number, feedback?: string) {
        const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) throw new Error('Ticket não encontrado');

        return this.prisma.evaluation.upsert({
            where: { ticketId },
            create: {
                ticketId,
                companyId: ticket.companyId,
                customerRating: rating,
                customerFeedback: feedback,
                aiSentiment: 'NEUTRAL',
                aiSentimentScore: 0,
                aiSummary: 'Avaliação manual do cliente',
                aiJustification: 'Enviado via CSAT público',
            },
            update: {
                customerRating: rating,
                customerFeedback: feedback,
            }
        });
    }

    /**
     * Quando o cliente responde ao CSAT, re-executa a análise sentimental
     * para que o score final incorpore a nota 1-5 do cliente.
     */
    @OnEvent('csat.received')
    async onCsatReceived(payload: { ticketId: string; companyId: string; customerRating: number }) {
        if (!payload.ticketId || !payload.companyId) return;
        this.logger.log(`Re-analisando sentimento após CSAT (nota ${payload.customerRating}/5) para ticket ${payload.ticketId}`);

        // Forçar re-análise (ignorar cache de 2min): zeramos o aiSentiment temporariamente
        await this.prisma.evaluation.updateMany({
            where: { ticketId: payload.ticketId, companyId: payload.companyId },
            data: { aiSentiment: null as any },
        });

        this.generateAISentimentAnalysis(payload.companyId, payload.ticketId).catch(err => {
            this.logger.error(`Falha na re-análise pós-CSAT para ticket ${payload.ticketId}: ${err.message}`);
        });
    }
}

