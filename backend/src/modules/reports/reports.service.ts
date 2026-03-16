import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

function parseDate(value: string, fieldName: string): Date {
    const d = new Date(value);
    if (isNaN(d.getTime())) throw new BadRequestException(`${fieldName} inválida: "${value}"`);
    return d;
}

function buildDateRange(startDate?: string, endDate?: string) {
    if (!startDate || !endDate) return undefined;
    const gte = parseDate(startDate, 'startDate');
    const lte = parseDate(endDate, 'endDate');
    if (gte > lte) throw new BadRequestException('startDate deve ser anterior a endDate');
    return { gte, lte };
}

@Injectable()
export class ReportsService {
    constructor(private prisma: PrismaService) { }

    private async getContactIdsForCustomer(companyId: string, customerId: string): Promise<string[]> {
        const contacts = await this.prisma.contact.findMany({
            where: { customerId, companyId },
            select: { id: true },
        });
        return contacts.map(c => c.id);
    }

    async getDashboardStats(companyId: string, startDate?: string, endDate?: string, customerId?: string) {
        const dateRange = buildDateRange(startDate, endDate);
        const where: any = { companyId };
        if (dateRange) where.createdAt = dateRange;
        if (customerId) {
            const contactIds = await this.getContactIdsForCustomer(companyId, customerId);
            where.contactId = { in: contactIds };
        }

        const [totalTickets, resolvedTickets, openTickets, messagesCount] = await Promise.all([
            this.prisma.ticket.count({ where }),
            this.prisma.ticket.count({ where: { ...where, status: 'RESOLVED' } }),
            this.prisma.ticket.count({ where: { ...where, status: 'OPEN' } }),
            this.prisma.message.count({
                where: {
                    ticket: { companyId, ...(customerId ? { contactId: where.contactId } : {}) },
                    sentAt: where.createdAt
                }
            }),
        ]);

        return {
            totalTickets,
            resolvedTickets,
            openTickets,
            messagesCount,
            resolutionRate: totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0,
        };
    }

    async getAgentPerformance(companyId: string, startDate?: string, endDate?: string, customerId?: string) {
        const dateRange = buildDateRange(startDate, endDate);
        const ticketWhere: any = { status: 'RESOLVED' };
        if (dateRange) ticketWhere.createdAt = dateRange;
        if (customerId) {
            const contactIds = await this.getContactIdsForCustomer(companyId, customerId);
            ticketWhere.contactId = { in: contactIds };
        }

        const agents = await this.prisma.user.findMany({
            where: { companyId },
            select: {
                id: true,
                name: true,
                _count: {
                    select: {
                        assignedTickets: { where: ticketWhere },
                    }
                }
            }
        });

        return agents.map(agent => ({
            id: agent.id,
            name: agent.name,
            resolvedCount: agent._count.assignedTickets,
        }));
    }

    async getSatisfactionTrend(companyId: string, days = 30) {
        const since = new Date();
        since.setDate(since.getDate() - Number(days));

        const evaluations = await this.prisma.evaluation.findMany({
            where: { ticket: { companyId }, createdAt: { gte: since } },
            select: { createdAt: true, aiSentimentScore: true, aiSentiment: true, customerRating: true },
            orderBy: { createdAt: 'asc' },
        });

        const grouped = new Map<string, { scores: number[]; ratings: number[]; positive: number; negative: number; neutral: number }>();
        for (const ev of evaluations) {
            const date = ev.createdAt.toISOString().slice(0, 10);
            if (!grouped.has(date)) grouped.set(date, { scores: [], ratings: [], positive: 0, negative: 0, neutral: 0 });
            const d = grouped.get(date)!;
            d.scores.push(ev.aiSentimentScore);
            if (ev.customerRating) d.ratings.push(ev.customerRating);
            if (ev.aiSentiment === 'POSITIVE') d.positive++;
            else if (ev.aiSentiment === 'NEGATIVE') d.negative++;
            else d.neutral++;
        }

        return Array.from(grouped.entries()).map(([date, d]) => ({
            date,
            avgScore: d.scores.length ? +(d.scores.reduce((a, b) => a + b, 0) / d.scores.length).toFixed(2) : null,
            avgRating: d.ratings.length ? +(d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length).toFixed(2) : null,
            positive: d.positive, negative: d.negative, neutral: d.neutral, total: d.scores.length,
        }));
    }

    async getSlaCompliance(companyId: string, startDate?: string, endDate?: string, customerId?: string) {
        const dateRange = buildDateRange(startDate, endDate);
        const where: any = { companyId, resolvedAt: { not: null } };
        if (dateRange) where.createdAt = dateRange;
        if (customerId) {
            const contactIds = await this.getContactIdsForCustomer(companyId, customerId);
            where.contactId = { in: contactIds };
        }

        const tickets = await this.prisma.ticket.findMany({
            where,
            select: { createdAt: true, resolvedAt: true, department: { select: { slaResolutionMin: true } } },
        });

        const grouped = new Map<string, { compliant: number; breached: number }>();
        for (const t of tickets) {
            const date = t.createdAt.toISOString().slice(0, 10);
            if (!grouped.has(date)) grouped.set(date, { compliant: 0, breached: 0 });
            const d = grouped.get(date)!;
            const slaMin = t.department?.slaResolutionMin || 1440;
            const resolutionMin = (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 60000;
            if (resolutionMin <= slaMin) d.compliant++;
            else d.breached++;
        }

        return Array.from(grouped.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, d]) => ({ date, ...d, total: d.compliant + d.breached }));
    }

    async getResolutionTime(companyId: string, startDate?: string, endDate?: string, customerId?: string) {
        const dateRange = buildDateRange(startDate, endDate);
        const where: any = { companyId, status: 'RESOLVED', resolvedAt: { not: null }, assignedUserId: { not: null } };
        if (dateRange) where.resolvedAt = dateRange;
        if (customerId) {
            const contactIds = await this.getContactIdsForCustomer(companyId, customerId);
            where.contactId = { in: contactIds };
        }

        const tickets = await this.prisma.ticket.findMany({
            where,
            select: { createdAt: true, resolvedAt: true, assignedUser: { select: { name: true } } },
        });

        const agentMap = new Map<string, { totalMin: number; count: number }>();
        for (const t of tickets) {
            const name = t.assignedUser?.name || 'Sem agente';
            if (!agentMap.has(name)) agentMap.set(name, { totalMin: 0, count: 0 });
            const d = agentMap.get(name)!;
            d.totalMin += (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 60000;
            d.count++;
        }

        return Array.from(agentMap.entries())
            .map(([agentName, d]) => ({ agentName, avgMinutes: Math.round(d.totalMin / d.count), count: d.count }))
            .sort((a, b) => a.avgMinutes - b.avgMinutes);
    }

    async exportToCsv(
        companyId: string,
        type: 'agent_performance' | 'sla_compliance' | 'resolution_time' | 'satisfaction',
        params: { startDate?: string; endDate?: string; days?: number },
    ): Promise<string> {
        let rows: Record<string, any>[] = [];

        if (type === 'agent_performance') {
            rows = await this.getAgentPerformance(companyId, params.startDate, params.endDate);
        } else if (type === 'sla_compliance') {
            rows = await this.getSlaCompliance(companyId, params.startDate, params.endDate);
        } else if (type === 'resolution_time') {
            rows = await this.getResolutionTime(companyId, params.startDate, params.endDate);
        } else if (type === 'satisfaction') {
            rows = await this.getSatisfactionTrend(companyId, params.days ?? 30);
        }

        if (!rows.length) return '';

        const headers = Object.keys(rows[0]);
        const escape = (v: any) => {
            const s = v == null ? '' : String(v);
            return s.includes(',') || s.includes('"') || s.includes('\n')
                ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const lines = [
            headers.join(','),
            ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
        ];
        return lines.join('\r\n');
    }

    async getInternalChatAudit(
        companyId: string,
        query?: string,
        startDate?: string,
        endDate?: string,
        limit = 100,
    ) {
        const safeLimit = Math.min(Math.max(1, Number(limit) || 100), 500);
        const dateRange = buildDateRange(startDate, endDate);
        const where: any = { chat: { companyId } };

        if (query) where.content = { contains: query, mode: 'insensitive' };
        if (dateRange) where.sentAt = dateRange;

        return this.prisma.internalChatMessage.findMany({
            where,
            include: {
                sender: { select: { id: true, name: true, email: true } },
                chat: { select: { id: true, name: true, type: true } }
            },
            orderBy: { sentAt: 'desc' },
            take: safeLimit,
        });
    }
}
