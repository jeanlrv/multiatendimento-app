import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TicketStatus, Sentiment, Prisma } from '@prisma/client';
import Redis from 'ioredis';

@Injectable()
export class DashboardService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(DashboardService.name);
    private redis: Redis;

    constructor(private prisma: PrismaService) {
        const retryStrategy = (times: number) =>
            times >= 10 ? 30000 : Math.min(500 * Math.pow(2, times - 1), 10000);
        const baseOpts = { lazyConnect: true, connectTimeout: 35000, maxRetriesPerRequest: null, retryStrategy };
        const redisUrl = process.env.REDIS_URL;
        this.redis = redisUrl
            ? new Redis(redisUrl, baseOpts as any)
            : new Redis({
                ...baseOpts,
                host: process.env.REDIS_HOST || 'localhost',
                port: Number(process.env.REDIS_PORT) || 6379,
                password: process.env.REDIS_PASSWORD || undefined,
            });
        this.redis.on('error', (err) => this.logger.warn(`Redis Dashboard: ${err.message}`));
    }

    async onModuleInit() {
        this.redis.connect().catch((err) =>
            this.logger.warn(`Redis Dashboard não conectou no boot: ${err.message}. Reconectará automaticamente.`),
        );
    }

    async onModuleDestroy() {
        try { await this.redis.quit(); } catch { /* silencioso */ }
    }

    private async getCached<T>(key: string): Promise<T | null> {
        try {
            const val = await this.redis.get(key);
            return val ? (JSON.parse(val) as T) : null;
        } catch (e) {
            this.logger.warn(`Cache GET falhou para key=${key}: ${(e as Error).message}`);
            return null;
        }
    }

    private async setCached(key: string, value: unknown, ttlSeconds: number): Promise<void> {
        try {
            await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        } catch (e) {
            this.logger.warn(`Cache SET falhou para key=${key}: ${(e as Error).message}`);
        }
    }

    /** Normaliza a chave de cache para evitar explosão de entradas no Redis com combinações ilimitadas de filtros */
    private normalizeFilterKey(filters: Record<string, any>): string {
        return Object.keys(filters)
            .sort()
            .filter(k => filters[k] !== undefined && filters[k] !== null && filters[k] !== 'ALL' && filters[k] !== '')
            .map(k => `${k}=${filters[k]}`)
            .join('|');
    }

    async getStats(companyId: string, filters: { startDate?: string, endDate?: string, departmentId?: string, assignedUserId?: string, customerId?: string }) {
        const cacheKey = `dash:stats:${companyId}:${this.normalizeFilterKey(filters)}`;
        const cached = await this.getCached<object>(cacheKey);
        if (cached) return cached;

        const where: any = { companyId };
        const evalWhere: any = { ticket: { companyId } };

        // Pre-fetch contact IDs for customer filter (required for groupBy compatibility)
        if (filters.customerId) {
            const customerContacts = await this.prisma.contact.findMany({
                where: { customerId: filters.customerId, companyId },
                select: { id: true },
            });
            const contactIds = customerContacts.map(c => c.id);
            where.contactId = { in: contactIds };
            evalWhere.ticket = { ...evalWhere.ticket, contactId: { in: contactIds } };
        }

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

        const [
            activeTickets,
            resolvedTickets,
            totalMessages,
            sentimentStats,
        ] = await Promise.all([
            this.prisma.ticket.count({
                where: { ...where, status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING] } },
            }),
            this.prisma.ticket.count({ where: { ...where, status: TicketStatus.RESOLVED } }),
            this.prisma.message.count({ where: { ticket: where } }),
            this.prisma.evaluation.groupBy({
                by: ['aiSentiment'],
                where: evalWhere,
                _count: { aiSentiment: true },
            }),
        ]);

        const sentimentMap = {
            [Sentiment.POSITIVE]: 0,
            [Sentiment.NEUTRAL]: 0,
            [Sentiment.NEGATIVE]: 0,
        };
        sentimentStats.forEach(stat => {
            if (stat.aiSentiment) sentimentMap[stat.aiSentiment] = stat._count.aiSentiment;
        });

        const totalEvaluations = Object.values(sentimentMap).reduce((a, b) => a + b, 0);
        const positiveCount = sentimentMap[Sentiment.POSITIVE] + sentimentMap[Sentiment.NEUTRAL];
        const satisfactionRating = totalEvaluations > 0
            ? Math.round((positiveCount / totalEvaluations) * 100)
            : 100;

        let historyDays = 30;
        if (filters.startDate && !filters.endDate) {
            const start = new Date(filters.startDate);
            historyDays = Math.ceil((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
        } else if (filters.startDate && filters.endDate) {
            const start = new Date(filters.startDate);
            const end = new Date(filters.endDate);
            historyDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const [customersByStatus, newCustomersThisMonth] = await Promise.all([
            this.prisma.customer.groupBy({ by: ['status'], where: { companyId }, _count: true }),
            this.prisma.customer.count({ where: { companyId, createdAt: { gte: startOfMonth } } }),
        ]);

        const result = {
            tickets: { active: activeTickets, resolved: resolvedTickets },
            messages: totalMessages,
            satisfaction: `${satisfactionRating}%`,
            sentimentDistribution: sentimentMap,
            recentActivity: await this.getRecentActivity(companyId, filters.departmentId, filters.assignedUserId, filters.customerId),
            history: await this.getHistory(companyId, historyDays, filters.startDate, filters.departmentId, filters.assignedUserId, filters.customerId),
            ticketsByDepartment: await this.getTicketsByDepartment(where),
            ticketsByStatus: await this.getTicketsByStatus(where),
            ticketsByPriority: await this.getTicketsByPriority(where),
            customers: {
                byStatus: customersByStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {} as Record<string, number>),
                newThisMonth: newCustomersThisMonth,
            },
        };

        await this.setCached(cacheKey, result, 300);
        return result;
    }

    private async getTicketsByDepartment(where: any) {
        const stats = await this.prisma.ticket.groupBy({
            by: ['departmentId'],
            where,
            _count: { id: true },
        });

        const departments = await this.prisma.department.findMany({
            where: { id: { in: stats.map(s => s.departmentId) } },
            select: { id: true, name: true },
        });

        return stats.map(s => ({
            name: departments.find(d => d.id === s.departmentId)?.name || 'Sem Depto',
            value: s._count.id,
        }));
    }

    private async getTicketsByStatus(where: any) {
        const stats = await this.prisma.ticket.groupBy({
            by: ['status'],
            where,
            _count: { id: true },
        });
        return stats.map(s => ({ status: s.status, value: s._count.id }));
    }

    private async getTicketsByPriority(where: any) {
        const stats = await this.prisma.ticket.groupBy({
            by: ['priority'],
            where,
            _count: { id: true },
        });
        return stats.map(s => ({ priority: s.priority, value: s._count.id }));
    }

    async getHistory(
        companyId: string,
        days: number,
        filterStartDate?: string,
        departmentId?: string,
        assignedUserId?: string,
        customerId?: string,
    ) {
        const cacheKey = `dash:history:${companyId}:${days}:${filterStartDate ?? ''}:${departmentId ?? ''}:${assignedUserId ?? ''}:${customerId ?? ''}`;
        const cached = await this.getCached<object[]>(cacheKey);
        if (cached) return cached;

        let startDate: Date;
        if (filterStartDate) {
            startDate = new Date(filterStartDate);
        } else {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
        }
        startDate.setHours(0, 0, 0, 0);

        // Optional filters as Prisma SQL fragments (columns are camelCase — no @map on fields)
        const deptFilter = departmentId && departmentId !== 'ALL'
            ? Prisma.sql`AND "departmentId" = ${departmentId}`
            : Prisma.empty;
        const userFilter = assignedUserId && assignedUserId !== 'ALL'
            ? Prisma.sql`AND "assignedUserId" = ${assignedUserId}`
            : Prisma.empty;
        const ticketDeptFilter = departmentId && departmentId !== 'ALL'
            ? Prisma.sql`AND t."departmentId" = ${departmentId}`
            : Prisma.empty;
        const ticketUserFilter = assignedUserId && assignedUserId !== 'ALL'
            ? Prisma.sql`AND t."assignedUserId" = ${assignedUserId}`
            : Prisma.empty;
        const customerFilter = customerId
            ? Prisma.sql`AND "contactId" IN (SELECT id FROM contacts WHERE "customerId" = ${customerId})`
            : Prisma.empty;
        const ticketCustomerFilter = customerId
            ? Prisma.sql`AND t."contactId" IN (SELECT id FROM contacts WHERE "customerId" = ${customerId})`
            : Prisma.empty;

        const [ticketRows, evalRows] = await Promise.all([
            this.prisma.$queryRaw<Array<{ date: string; opened: bigint; resolved: bigint }>>`
                SELECT
                    DATE_TRUNC('day', "createdAt")::date::text AS date,
                    COUNT(*)::bigint                           AS opened,
                    COUNT(*) FILTER (WHERE status = 'RESOLVED')::bigint AS resolved
                FROM tickets
                WHERE "companyId" = ${companyId}
                    AND "createdAt" >= ${startDate}
                    ${deptFilter}
                    ${userFilter}
                    ${customerFilter}
                GROUP BY 1
                ORDER BY 1
            `,
            this.prisma.$queryRaw<Array<{ date: string; sentiment: number | null }>>`
                SELECT
                    DATE_TRUNC('day', e."createdAt")::date::text AS date,
                    AVG(e."aiSentimentScore")::float              AS sentiment
                FROM evaluations e
                JOIN tickets t ON t.id = e."ticketId"
                WHERE t."companyId" = ${companyId}
                    AND e."createdAt" >= ${startDate}
                    ${ticketDeptFilter}
                    ${ticketUserFilter}
                    ${ticketCustomerFilter}
                GROUP BY 1
                ORDER BY 1
            `,
        ]);

        // Build date map (all days in range, even empty ones)
        const historyMap = new Map<string, { date: string; opened: number; resolved: number; sentiment: number }>();
        for (let i = 0; i <= days; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            historyMap.set(dateStr, { date: dateStr, opened: 0, resolved: 0, sentiment: 0 });
        }

        ticketRows.forEach(r => {
            const entry = historyMap.get(r.date);
            if (entry) { entry.opened = Number(r.opened); entry.resolved = Number(r.resolved); }
        });

        evalRows.forEach(r => {
            const entry = historyMap.get(r.date);
            if (entry && r.sentiment != null) entry.sentiment = Number(r.sentiment.toFixed(1));
        });

        const result = Array.from(historyMap.values());
        await this.setCached(cacheKey, result, 300);
        return result;
    }

    private async getRecentActivity(companyId: string, departmentId?: string, assignedUserId?: string, customerId?: string) {
        const where: any = { companyId };
        if (departmentId && departmentId !== 'ALL') where.departmentId = departmentId;
        if (assignedUserId && assignedUserId !== 'ALL') where.assignedUserId = assignedUserId;
        if (customerId) where.contact = { customerId };

        const recentTickets = await this.prisma.ticket.findMany({
            where,
            take: 5,
            orderBy: { updatedAt: 'desc' },
            include: {
                contact: { select: { name: true } },
                assignedUser: { select: { name: true } },
            },
        });

        return recentTickets.map(t => ({
            id: t.id,
            contactName: t.contact.name,
            userName: t.assignedUser?.name || 'Sistema',
            status: t.status,
            updatedAt: t.updatedAt,
        }));
    }

    // ─── Ranking de agentes ──────────────────────────────────────────────────

    async getAgentRanking(companyId: string, filters: { startDate?: string; departmentId?: string; customerId?: string }) {
        const cacheKey = `dash:ranking:${companyId}:${filters.startDate ?? ''}:${filters.departmentId ?? ''}:${filters.customerId ?? ''}`;
        const cached = await this.getCached<object[]>(cacheKey);
        if (cached) return cached;

        const where: any = { companyId, status: TicketStatus.RESOLVED };
        if (filters.departmentId && filters.departmentId !== 'ALL') where.departmentId = filters.departmentId;
        if (filters.startDate) {
            const d = new Date(filters.startDate);
            d.setHours(0, 0, 0, 0);
            where.updatedAt = { gte: d };
        }
        if (filters.customerId) {
            const customerContacts = await this.prisma.contact.findMany({
                where: { customerId: filters.customerId, companyId },
                select: { id: true },
            });
            where.contactId = { in: customerContacts.map(c => c.id) };
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

        const result = grouped.map((g, idx) => ({
            rank: idx + 1,
            userId: g.assignedUserId,
            name: users.find(u => u.id === g.assignedUserId)?.name || 'Desconhecido',
            avatar: users.find(u => u.id === g.assignedUserId)?.avatar,
            resolved: g._count.id,
        }));

        await this.setCached(cacheKey, result, 1800);
        return result;
    }

    // ─── Heatmap de volume por hora/dia da semana ─────────────────────────────

    async getHeatmap(companyId: string, filters: { startDate?: string; departmentId?: string; customerId?: string }) {
        const cacheKey = `dash:heatmap:${companyId}:${filters.startDate ?? ''}:${filters.departmentId ?? ''}:${filters.customerId ?? ''}`;
        const cached = await this.getCached<object[]>(cacheKey);
        if (cached) return cached;

        const startDate = filters.startDate
            ? new Date(filters.startDate)
            : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
        startDate.setHours(0, 0, 0, 0);

        const deptFilter = filters.departmentId && filters.departmentId !== 'ALL'
            ? Prisma.sql`AND "departmentId" = ${filters.departmentId}`
            : Prisma.empty;
        const customerFilter = filters.customerId
            ? Prisma.sql`AND "contactId" IN (SELECT id FROM contacts WHERE "customerId" = ${filters.customerId})`
            : Prisma.empty;

        const rows = await this.prisma.$queryRaw<Array<{ day: number; hour: number; count: bigint }>>`
            SELECT
                EXTRACT(DOW  FROM "createdAt")::int  AS day,
                EXTRACT(HOUR FROM "createdAt")::int  AS hour,
                COUNT(*)::bigint                     AS count
            FROM tickets
            WHERE "companyId" = ${companyId}
                AND "createdAt" >= ${startDate}
                ${deptFilter}
                ${customerFilter}
            GROUP BY 1, 2
            ORDER BY 1, 2
        `;

        const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

        // Build full 7×24 grid, fill from SQL results
        const grid = new Map<string, number>();
        for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) grid.set(`${d}-${h}`, 0);
        rows.forEach(r => grid.set(`${r.day}-${r.hour}`, Number(r.count)));

        const result = Array.from(grid.entries()).map(([key, count]) => {
            const [d, h] = key.split('-').map(Number);
            return { day: DAYS[d], hour: h, count };
        });

        await this.setCached(cacheKey, result, 3600);
        return result;
    }
}
