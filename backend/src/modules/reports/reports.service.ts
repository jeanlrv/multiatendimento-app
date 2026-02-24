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

    async getDashboardStats(companyId: string, startDate?: string, endDate?: string) {
        const dateRange = buildDateRange(startDate, endDate);
        const where: any = { companyId };
        if (dateRange) where.createdAt = dateRange;

        const [totalTickets, resolvedTickets, openTickets, messagesCount] = await Promise.all([
            this.prisma.ticket.count({ where }),
            this.prisma.ticket.count({ where: { ...where, status: 'RESOLVED' } }),
            this.prisma.ticket.count({ where: { ...where, status: 'OPEN' } }),
            this.prisma.message.count({
                where: {
                    ticket: { companyId },
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

    async getAgentPerformance(companyId: string, startDate?: string, endDate?: string) {
        const dateRange = buildDateRange(startDate, endDate);
        const where: any = { companyId };
        if (dateRange) where.createdAt = dateRange;

        const agents = await this.prisma.user.findMany({
            where: { companyId },
            select: {
                id: true,
                name: true,
                _count: {
                    select: {
                        assignedTickets: { where: { status: 'RESOLVED', ...where } },
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
