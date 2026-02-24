import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';

@Injectable()
export class IntegrationsService {
    constructor(
        private prisma: PrismaService,
        private crypto: CryptoService,
    ) { }

    /** Mascara os tokens sensíveis antes de retornar para a API */
    private maskIntegration(integration: any) {
        return {
            ...integration,
            zapiToken: integration.zapiToken ? this.crypto.mask(integration.zapiToken) : null,
            zapiClientToken: integration.zapiClientToken ? this.crypto.mask(integration.zapiClientToken) : null,
        };
    }

    async findAll(companyId: string) {
        const integrations = await this.prisma.integration.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
        });
        return integrations.map(i => this.maskIntegration(i));
    }

    async findOne(id: string, companyId: string) {
        const integration = await this.prisma.integration.findFirst({
            where: { id, companyId },
        });

        if (!integration) {
            throw new NotFoundException('Integração não encontrada');
        }

        return this.maskIntegration(integration);
    }

    async create(data: any, companyId: string) {
        const payload = { ...data };
        if (payload.zapiToken) payload.zapiToken = this.crypto.encrypt(payload.zapiToken);
        if (payload.zapiClientToken) payload.zapiClientToken = this.crypto.encrypt(payload.zapiClientToken);

        const integration = await this.prisma.integration.create({
            data: {
                ...payload,
                company: { connect: { id: companyId } },
            },
        });

        return this.maskIntegration(integration);
    }

    async update(id: string, data: any, companyId: string) {
        await this.findOne(id, companyId);

        const payload = { ...data };
        if (payload.zapiToken && !payload.zapiToken.includes('***')) {
            payload.zapiToken = this.crypto.encrypt(payload.zapiToken);
        }
        if (payload.zapiClientToken && !payload.zapiClientToken.includes('***')) {
            payload.zapiClientToken = this.crypto.encrypt(payload.zapiClientToken);
        }

        const updated = await this.prisma.integration.update({
            where: { id },
            data: payload,
        });

        return this.maskIntegration(updated);
    }

    async remove(id: string, companyId: string) {
        await this.findOne(id, companyId);

        return this.prisma.integration.delete({
            where: { id },
        });
    }

    /** Uso interno — retorna tokens descriptografados para chamadas Z-API */
    async findZapiConfig(companyId: string) {
        const integration = await this.prisma.integration.findFirst({
            where: {
                companyId,
                provider: 'ZAPI',
                isActive: true,
            },
        });

        if (!integration) return null;

        return {
            ...integration,
            zapiToken: this.crypto.decrypt(integration.zapiToken),
            zapiClientToken: integration.zapiClientToken
                ? this.crypto.decrypt(integration.zapiClientToken)
                : null,
        };
    }
}
