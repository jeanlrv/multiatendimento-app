import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class ApiKeysService {
    private readonly logger = new Logger(ApiKeysService.name);

    constructor(private prisma: PrismaService) { }

    async createKey(companyId: string, name: string, agentId?: string) {
        const token = 'kszap_' + randomBytes(32).toString('hex');
        const keyHash = createHash('sha256').update(token).digest('hex');
        const keyPrefix = token.substring(0, 12);

        const apiKey = await (this.prisma as any).aPIKey.create({
            data: {
                name,
                keyHash,
                keyPrefix,
                companyId,
                agentId,
            }
        });

        // Retornar o token original APENAS uma vez na criação
        return {
            ...apiKey,
            token
        };
    }

    async listKeys(companyId: string) {
        return (this.prisma as any).aPIKey.findMany({
            where: { companyId },
            include: {
                agent: {
                    select: { name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async revokeKey(companyId: string, id: string) {
        return (this.prisma as any).aPIKey.deleteMany({
            where: { id, companyId }
        });
    }

    async validateKey(token: string) {
        const keyHash = createHash('sha256').update(token).digest('hex');

        const apiKey = await (this.prisma as any).aPIKey.findUnique({
            where: { keyHash },
            include: { agent: true }
        });

        if (!apiKey || !apiKey.isActive) {
            return null;
        }

        // Atualizar lastUsedAt de forma assíncrona (não bloqueante)
        (this.prisma as any).aPIKey.update({
            where: { id: apiKey.id },
            data: { lastUsedAt: new Date() }
        }).catch(err => this.logger.error(`Erro ao atualizar lastUsedAt da API Key: ${err.message}`));

        return apiKey;
    }
}
