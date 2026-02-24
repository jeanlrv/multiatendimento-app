import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

interface AuditData {
    userId: string;
    companyId: string; // Torna obrigatório para multi-tenancy
    action: string;
    entity: string;
    entityId: string;
    changes?: any;
    ipAddress?: string;
    userAgent?: string;
}

interface AuditQuery {
    companyId: string;
    action?: string;
    entity?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}

@Injectable()
export class AuditService {
    constructor(private prisma: PrismaService) { }

    async log(data: AuditData) {
        try {
            return await this.prisma.auditLog.create({
                data: {
                    userId: data.userId,
                    companyId: data.companyId,
                    action: data.action,
                    entity: data.entity,
                    entityId: data.entityId,
                    changes: data.changes || {},
                    ipAddress: data.ipAddress,
                    userAgent: data.userAgent,
                },
            });
        } catch (error) {
            console.error('Falha ao gravar log de auditoria:', error);
        }
    }

    async findAll(query: AuditQuery) {
        const { companyId, action, entity, userId, startDate, endDate, page = 1, limit = 50 } = query;

        const where: any = { companyId };

        if (action) where.action = { contains: action, mode: 'insensitive' };
        if (entity) where.entity = { contains: entity, mode: 'insensitive' };
        if (userId) where.userId = userId;
        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }

        const skip = (page - 1) * limit;

        const [data, total] = await this.prisma.$transaction([
            this.prisma.auditLog.findMany({
                where,
                include: {
                    user: {
                        select: { id: true, name: true, email: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.auditLog.count({ where }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
