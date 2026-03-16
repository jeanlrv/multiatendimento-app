import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AIMetricsService {
    private readonly logger = new Logger(AIMetricsService.name);

    /** Custo estimado por 1.000 tokens de entrada (USD) */
    private readonly COST_INPUT: Record<string, number> = {
        'gpt-4o-mini': 0.00015, 'gpt-4o': 0.005,
        'claude-3-5-sonnet-20241022': 0.003, 'claude-3-5-haiku-20241022': 0.0008,
        'claude-3-opus-20240229': 0.015,
        'gemini-2.0-flash': 0.0001, 'gemini-1.5-pro': 0.00125,
        'deepseek-chat': 0.00027, 'deepseek-reasoner': 0.00055,
        'llama-3.1-8b-instant': 0.00005, 'llama-3.1-70b-versatile': 0.00059,
        'mistral-large-latest': 0.002,
    };

    /** Custo estimado por 1.000 tokens de saída (USD) */
    private readonly COST_OUTPUT: Record<string, number> = {
        'gpt-4o-mini': 0.0006, 'gpt-4o': 0.015,
        'claude-3-5-sonnet-20241022': 0.015, 'claude-3-5-haiku-20241022': 0.004,
        'claude-3-opus-20240229': 0.075,
        'gemini-2.0-flash': 0.0004, 'gemini-1.5-pro': 0.005,
        'deepseek-chat': 0.00110, 'deepseek-reasoner': 0.00219,
        'llama-3.1-8b-instant': 0.00008, 'llama-3.1-70b-versatile': 0.00079,
        'mistral-large-latest': 0.006,
    };

    constructor(
        private prisma: PrismaService,
        private eventEmitter: EventEmitter2,
    ) { }

    /**
     * Verifica limites de tokens da empresa (hora, dia, total).
     * Lança ForbiddenException se algum limite for atingido.
     * 0 = Ilimitado.
     */
    async checkTokenLimits(companyId: string, agentId?: string) {
        const [company, agent] = await Promise.all([
            this.prisma.company.findUnique({
                where: { id: companyId },
                select: { limitTokens: true, limitTokensPerHour: true, limitTokensPerDay: true }
            }),
            agentId ? this.prisma.aIAgent.findUnique({
                where: { id: agentId },
                select: { limitTokensPerDay: true }
            }) : null
        ]);

        if (!company) return;

        const now = new Date();
        const startOfHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

        const [hourlyUsage, dailyUsage, totalTokens] = await Promise.all([
            this.prisma.aIUsage.aggregate({
                where: { companyId, createdAt: { gte: startOfHour } },
                _sum: { tokens: true }
            }),
            this.prisma.aIUsage.aggregate({
                where: { companyId, createdAt: { gte: startOfDay } },
                _sum: { tokens: true }
            }),
            this.prisma.aIUsage.aggregate({
                where: { companyId },
                _sum: { tokens: true }
            }),
        ]);

        const hourlyTokens = hourlyUsage._sum.tokens || 0;
        const dailyTokens = dailyUsage._sum.tokens || 0;
        const totalTokensUsed = totalTokens._sum.tokens || 0;

        if (company.limitTokensPerHour > 0 && hourlyTokens >= company.limitTokensPerHour) {
            throw new ForbiddenException(`Limite de tokens por hora atingido (${company.limitTokensPerHour}). Tente novamente mais tarde.`);
        }

        let effectiveDayLimit = company.limitTokensPerDay;
        if (agent && agent.limitTokensPerDay > 0) {
            effectiveDayLimit = (effectiveDayLimit > 0)
                ? Math.min(effectiveDayLimit, agent.limitTokensPerDay)
                : agent.limitTokensPerDay;
        }

        if (effectiveDayLimit > 0 && dailyTokens >= effectiveDayLimit) {
            throw new ForbiddenException(`Limite de tokens por dia atingido (${effectiveDayLimit}). Tente novamente amanhã.`);
        }

        if (company.limitTokens > 0 && totalTokensUsed >= company.limitTokens) {
            throw new ForbiddenException(`Limite total de tokens de IA atingido (${company.limitTokens}). Entre em contato com o suporte.`);
        }
    }

    /**
     * Registra uso de tokens na tabela AIUsage.
     */
    async trackTokenUsage(
        companyId: string,
        modelId: string,
        systemPrompt: string,
        context: string,
        history: any[],
        response: string,
        imageCount: number = 0,
    ) {
        const historyChars = history.reduce((sum, h) => sum + (h.content?.length || 0), 0);
        const inputTokens = Math.ceil((systemPrompt.length + context.length + historyChars) / 4);
        const outputTokens = Math.ceil(response.length / 4);
        const imageTokens = imageCount * 500;
        const estimatedTokens = inputTokens + outputTokens + imageTokens;

        const baseModelId = modelId.includes(':') ? modelId.split(':').slice(1).join(':') : modelId;
        const costIn = (this.COST_INPUT[baseModelId] ?? this.COST_INPUT[modelId] ?? 0) * inputTokens / 1000;
        const costOut = (this.COST_OUTPUT[baseModelId] ?? this.COST_OUTPUT[modelId] ?? 0) * outputTokens / 1000;
        const estimatedCost = parseFloat((costIn + costOut).toFixed(8));

        await this.prisma.aIUsage.create({
            data: { companyId, tokens: estimatedTokens, cost: estimatedCost }
        });

        this.checkCostAlert(companyId, estimatedCost).catch(() => { });
    }

    /**
     * Verifica se o custo diário da empresa ultrapassou o limite configurado.
     */
    async checkCostAlert(companyId: string, estimatedCost: number): Promise<void> {
        try {
            const company = await this.prisma.company.findUnique({
                where: { id: companyId },
                select: { dailyCostAlertUsd: true },
            });
            if (!company?.dailyCostAlertUsd || company.dailyCostAlertUsd <= 0) return;

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const dailyCost = await this.prisma.aIUsage.aggregate({
                where: { companyId, createdAt: { gte: startOfDay } },
                _sum: { cost: true },
            });
            const totalDailyCost = (dailyCost._sum.cost ?? 0) + estimatedCost;
            if (totalDailyCost >= company.dailyCostAlertUsd) {
                const existingAlert = await this.prisma.notification.findFirst({
                    where: { companyId, event: 'ai.cost_alert', createdAt: { gte: startOfDay } },
                });
                if (!existingAlert) {
                    await this.prisma.notification.create({
                        data: {
                            companyId,
                            type: 'WARNING',
                            event: 'ai.cost_alert',
                            title: 'Alerta de custo de IA',
                            body: `O custo diário de IA atingiu $${totalDailyCost.toFixed(4)} (limite: $${company.dailyCostAlertUsd.toFixed(4)}).`,
                            data: { totalDailyCost, threshold: company.dailyCostAlertUsd },
                        },
                    });
                    this.eventEmitter.emit('ai.cost_alert', { companyId, totalDailyCost, threshold: company.dailyCostAlertUsd });
                    this.logger.warn(`[CostAlert] Empresa ${companyId}: custo diário $${totalDailyCost.toFixed(4)} ≥ limite $${company.dailyCostAlertUsd}`);
                }
            }
        } catch (e) {
            this.logger.warn(`[CostAlert] Falha ao verificar alerta de custo: ${e.message}`);
        }
    }

    /** Retorna o uso acumulado de tokens/IA da empresa. */
    async getUsage(companyId: string) {
        const totalTokens = await this.prisma.aIUsage.aggregate({
            where: { companyId },
            _sum: { tokens: true, cost: true },
            _count: true,
        });
        return {
            totalTokens: totalTokens._sum.tokens || 0,
            totalCost: totalTokens._sum.cost || 0,
            totalCalls: totalTokens._count || 0,
        };
    }

    /** Retorna métricas detalhadas de uso da IA. */
    async getDetailedMetrics(companyId: string) {
        try {
            const usage = await this.getUsage(companyId);

            const [dailyUsage, agentUsage, modelUsage] = await Promise.all([
                this.prisma.$queryRaw`
                    SELECT DATE("createdAt") as date, SUM(tokens) as tokens, COUNT(*) as calls
                    FROM "ai_usage"
                    WHERE "companyId" = ${companyId}
                    AND "createdAt" >= CURRENT_DATE - INTERVAL '30 days'
                    GROUP BY DATE("createdAt")
                    ORDER BY date ASC
                `.catch(() => []),
                this.prisma.$queryRaw`
                    SELECT a.name as "agentName", a."modelId" as model, a."isActive" as active
                    FROM "ai_agents" a
                    WHERE a."companyId" = ${companyId}
                    ORDER BY a.name ASC
                `.catch(() => []),
                this.prisma.$queryRaw`
                    SELECT a."modelId" as model, COUNT(a.id) as "agentCount"
                    FROM "ai_agents" a
                    WHERE a."companyId" = ${companyId} AND a."modelId" IS NOT NULL
                    GROUP BY a."modelId"
                    ORDER BY "agentCount" DESC
                `.catch(() => []),
            ]);

            return {
                usage,
                dailyUsage: Array.isArray(dailyUsage) ? dailyUsage : [],
                agentUsage: Array.isArray(agentUsage) ? agentUsage : [],
                modelUsage: Array.isArray(modelUsage) ? modelUsage : []
            };
        } catch (error) {
            this.logger.error(`Erro ao buscar métricas detalhadas de AI para empresa ${companyId}: ${error.message}`);
            return {
                usage: { totalTokens: 0, totalCost: 0, totalCalls: 0 },
                dailyUsage: [], agentUsage: [], modelUsage: []
            };
        }
    }
}
