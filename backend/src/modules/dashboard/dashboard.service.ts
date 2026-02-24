import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TicketStatus, Sentiment } from '@prisma/client';

@Injectable()
export class DashboardService {
    private readonly logger = new Logger(DashboardService.name);

    constructor(private prisma: PrismaService) { }

    async getStats(companyId: string, filters: { startDate?: string, endDate?: string, departmentId?: string, assignedUserId?: string }) {
        this.logger.log(`Calculando estatísticas do dashboard para empresa ${companyId} com filtros: ${JSON.stringify(filters)}`);

        // companyId é OBRIGATÓRIO — multi-tenancy
        const where: any = { companyId };
        const evalWhere: any = { ticket: { companyId } };

        if (filters.departmentId && filters.departmentId !== 'ALL') {
            where.departmentId = filters.departmentId;
            evalWhere.ticket = { ...evalWhere.ticket, departmentId: filters.departmentId };
        }

        if (filters.assignedUserId && filters.assignedUserId !== 'ALL') {
            where.assignedUserId = filters.assignedUserId;
            evalWhere.ticket = { ...evalWhere.ticket, assignedUserId: filters.assignedUserId };
        }

        if (filters.startDate || filters.endDate) {
            where.createdAt = {};
            evalWhere.createdAt = {};

            if (filters.startDate) {
                const date = new Date(filters.startDate);
                date.setHours(0, 0, 0, 0);
                where.createdAt.gte = date;
                evalWhere.createdAt.gte = date;
            }

            if (filters.endDate) {
                const date = new Date(filters.endDate);
                date.setHours(23, 59, 59, 999);
                where.createdAt.lte = date;
                evalWhere.createdAt.lte = date;
            }
        }

        // Contagem de tickets por status
        const [
            activeTickets,
            resolvedTickets,
            totalMessages,
            sentimentStats
        ] = await Promise.all([
            this.prisma.ticket.count({
                where: {
                    ...where,
                    status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING] }
                }
            }),
            this.prisma.ticket.count({
                where: {
                    ...where,
                    status: TicketStatus.RESOLVED
                }
            }),
            this.prisma.message.count({
                where: { ticket: where }
            }),
            this.prisma.evaluation.groupBy({
                by: ['aiSentiment'],
                where: evalWhere,
                _count: { aiSentiment: true }
            })
        ]);

        // Mapear sentimentos para um formato amigável
        const sentimentMap = {
            [Sentiment.POSITIVE]: 0,
            [Sentiment.NEUTRAL]: 0,
            [Sentiment.NEGATIVE]: 0
        };

        sentimentStats.forEach(stat => {
            if (stat.aiSentiment) sentimentMap[stat.aiSentiment] = stat._count.aiSentiment;
        });

        // Calcular "Satisfação"
        const totalEvaluations = Object.values(sentimentMap).reduce((a, b) => a + b, 0);
        const positiveCount = sentimentMap[Sentiment.POSITIVE] + sentimentMap[Sentiment.NEUTRAL];
        const satisfactionRating = totalEvaluations > 0
            ? Math.round((positiveCount / totalEvaluations) * 100)
            : 100;

        // Calcular dias para o histórico
        let historyDays = 30;
        if (filters.startDate && !filters.endDate) {
            const start = new Date(filters.startDate);
            const now = new Date();
            historyDays = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        } else if (filters.startDate && filters.endDate) {
            const start = new Date(filters.startDate);
            const end = new Date(filters.endDate);
            historyDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }

        return {
            tickets: {
                active: activeTickets,
                resolved: resolvedTickets
            },
            messages: totalMessages,
            satisfaction: `${satisfactionRating}%`,
            sentimentDistribution: sentimentMap,
            recentActivity: await this.getRecentActivity(companyId, filters.departmentId, filters.assignedUserId),
            history: await this.getHistory(companyId, historyDays, filters.startDate, filters.departmentId, filters.assignedUserId),
            ticketsByDepartment: await this.getTicketsByDepartment(where),
            ticketsByStatus: await this.getTicketsByStatus(where),
            ticketsByPriority: await this.getTicketsByPriority(where),
        };
    }

    private async getTicketsByDepartment(where: any) {
        const stats = await this.prisma.ticket.groupBy({
            by: ['departmentId'],
            where,
            _count: { id: true },
        });

        const departments = await this.prisma.department.findMany({
            where: { id: { in: stats.map(s => s.departmentId) } },
            select: { id: true, name: true }
        });

        return stats.map(s => ({
            name: departments.find(d => d.id === s.departmentId)?.name || 'Sem Depto',
            value: s._count.id
        }));
    }

    private async getTicketsByStatus(where: any) {
        const stats = await this.prisma.ticket.groupBy({
            by: ['status'],
            where,
            _count: { id: true },
        });

        return stats.map(s => ({
            status: s.status,
            value: s._count.id
        }));
    }

    private async getTicketsByPriority(where: any) {
        const stats = await this.prisma.ticket.groupBy({
            by: ['priority'],
            where,
            _count: { id: true },
        });

        return stats.map(s => ({
            priority: s.priority,
            value: s._count.id
        }));
    }

    async getHistory(companyId: string, days: number, filterStartDate?: string, departmentId?: string, assignedUserId?: string) {
        this.logger.log(`Buscando histórico de ${days} dias para empresa ${companyId} (Depto: ${departmentId}, Atendente: ${assignedUserId})`);

        let startDate: Date;
        if (filterStartDate) {
            startDate = new Date(filterStartDate);
        } else {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
        }
        startDate.setHours(0, 0, 0, 0);

        // companyId OBRIGATÓRIO em ambas as queries
        const where: any = { companyId, createdAt: { gte: startDate } };
        const evalWhere: any = { ticket: { companyId }, createdAt: { gte: startDate } };

        if (departmentId && departmentId !== 'ALL') {
            where.departmentId = departmentId;
            evalWhere.ticket = { ...evalWhere.ticket, departmentId };
        }

        if (assignedUserId && assignedUserId !== 'ALL') {
            where.assignedUserId = assignedUserId;
            evalWhere.ticket = { ...evalWhere.ticket, assignedUserId };
        }

        const tickets = await this.prisma.ticket.findMany({
            where,
            select: { createdAt: true, status: true }
        });

        const evaluations = await this.prisma.evaluation.findMany({
            where: evalWhere,
            select: { createdAt: true, aiSentimentScore: true }
        });

        const historyMap = new Map();

        for (let i = 0; i <= days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            historyMap.set(dateStr, {
                date: dateStr,
                opened: 0,
                resolved: 0,
                sentiment: 0,
                sentimentCount: 0
            });
        }

        tickets.forEach(t => {
            const dateStr = t.createdAt.toISOString().split('T')[0];
            if (historyMap.has(dateStr)) {
                const dayData = historyMap.get(dateStr);
                dayData.opened++;
                if (t.status === TicketStatus.RESOLVED) {
                    dayData.resolved++;
                }
            }
        });

        evaluations.forEach(e => {
            const dateStr = e.createdAt.toISOString().split('T')[0];
            if (historyMap.has(dateStr)) {
                const dayData = historyMap.get(dateStr);
                dayData.sentiment += e.aiSentimentScore ?? 0;
                dayData.sentimentCount++;
            }
        });

        return Array.from(historyMap.values()).map(day => ({
            ...day,
            sentiment: day.sentimentCount > 0 ? Number((day.sentiment / day.sentimentCount).toFixed(1)) : 0
        }));
    }

    private async getRecentActivity(companyId: string, departmentId?: string, assignedUserId?: string) {
        // companyId OBRIGATÓRIO
        const where: any = { companyId };
        if (departmentId && departmentId !== 'ALL') {
            where.departmentId = departmentId;
        }
        if (assignedUserId && assignedUserId !== 'ALL') {
            where.assignedUserId = assignedUserId;
        }

        const recentTickets = await this.prisma.ticket.findMany({
            where,
            take: 5,
            orderBy: { updatedAt: 'desc' },
            include: {
                contact: { select: { name: true } },
                assignedUser: { select: { name: true } }
            }
        });

        return recentTickets.map(t => ({
            id: t.id,
            contactName: t.contact.name,
            userName: t.assignedUser?.name || 'Sistema',
            status: t.status,
            updatedAt: t.updatedAt
        }));
    }

    // ─── Ranking de agentes ──────────────────────────────────────────────────

    async getAgentRanking(companyId: string, filters: { startDate?: string; departmentId?: string }) {
        const where: any = { companyId, status: TicketStatus.RESOLVED };
        if (filters.departmentId && filters.departmentId !== 'ALL') where.departmentId = filters.departmentId;
        if (filters.startDate) {
            const d = new Date(filters.startDate);
            d.setHours(0, 0, 0, 0);
            where.updatedAt = { gte: d };
        }

        const grouped = await this.prisma.ticket.groupBy({
            by: ['assignedUserId'],
            where,
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 10,
        });

        const userIds = grouped.map(g => g.assignedUserId).filter(Boolean) as string[];
        const users = await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, avatar: true },
        });

        return grouped.map((g, idx) => ({
            rank: idx + 1,
            userId: g.assignedUserId,
            name: users.find(u => u.id === g.assignedUserId)?.name || 'Desconhecido',
            avatar: users.find(u => u.id === g.assignedUserId)?.avatar,
            resolved: g._count.id,
        }));
    }

    // ─── Heatmap de volume por hora/dia da semana ─────────────────────────────

    async getHeatmap(companyId: string, filters: { startDate?: string; departmentId?: string }) {
        const where: any = { companyId };
        if (filters.departmentId && filters.departmentId !== 'ALL') where.departmentId = filters.departmentId;
        if (filters.startDate) {
            const d = new Date(filters.startDate);
            d.setHours(0, 0, 0, 0);
            where.createdAt = { gte: d };
        } else {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            where.createdAt = { gte: d };
        }

        const tickets = await this.prisma.ticket.findMany({
            where,
            select: { createdAt: true },
        });

        // Inicializar grade 7 dias × 24 horas
        const grid: Record<string, number> = {};
        for (let d = 0; d < 7; d++) {
            for (let h = 0; h < 24; h++) {
                grid[`${d}-${h}`] = 0;
            }
        }

        tickets.forEach(t => {
            const day = t.createdAt.getDay(); // 0 Dom … 6 Sáb
            const hour = t.createdAt.getHours();
            grid[`${day}-${hour}`]++;
        });

        const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return Object.entries(grid).map(([key, count]) => {
            const [d, h] = key.split('-').map(Number);
            return { day: DAYS[d], hour: h, count };
        });
    }
}

