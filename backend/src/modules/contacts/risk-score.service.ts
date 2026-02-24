import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class RiskScoreService {
    private readonly logger = new Logger(RiskScoreService.name);

    constructor(private prisma: PrismaService) { }

    @OnEvent('evaluation.created')
    async handleEvaluation(payload: any) {
        const { ticketId, aiSentimentScore } = payload;
        const ticket = await this.prisma.ticket.findUnique({
            where: { id: ticketId },
            select: { contactId: true }
        });

        if (ticket) {
            await this.updateScore(ticket.contactId, aiSentimentScore < 5 ? 10 : -2);
        }
    }

    @OnEvent('ticket.cancelled')
    async handleCancellation(payload: any) {
        await this.updateScore(payload.contactId, 15);
    }

    private async updateScore(contactId: string, penalty: number) {
        const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
        if (!contact) return;

        let newScore = (contact.riskScore || 0) + penalty;
        newScore = Math.max(0, Math.min(100, newScore)); // Garantir entre 0 e 100

        await this.prisma.contact.update({
            where: { id: contactId },
            data: { riskScore: newScore }
        });

        this.logger.log(`Risk Score atualizado para contato ${contactId}: ${newScore}`);

        // Se o risco for muito alto, disparar evento de alerta crítico
        if (newScore > 80) {
            // Disparar evento para Workflows (ex: notificar gerente)
            // this.eventEmitter.emit('contact.high_risk', { contactId, score: newScore });
        }
    }

    async getRiskMetrics() {
        const highRiskCount = await this.prisma.contact.count({ where: { riskScore: { gt: 80 } } });
        const avgScore = await this.prisma.contact.aggregate({ _avg: { riskScore: true } });
        return { highRiskCount, avgScore: avgScore._avg.riskScore };
    }
}
