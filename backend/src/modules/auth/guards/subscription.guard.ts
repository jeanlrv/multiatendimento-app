import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../database/prisma.service';
import { LIMIT_KEY, ResourceLimit } from '../../../common/decorators/subscription-limit.decorator';

@Injectable()
export class SubscriptionGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private prisma: PrismaService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const resource = this.reflector.get<ResourceLimit>(LIMIT_KEY, context.getHandler());

        if (!resource) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const { user } = request;

        if (!user || !user.companyId) {
            throw new ForbiddenException('Contexto de empresa não encontrado');
        }

        const company = await this.prisma.company.findUnique({
            where: { id: user.companyId },
            select: {
                maxUsers: true,
                maxDepartments: true,
                maxWhatsApp: true,
                expiresAt: true,
            },
        });

        if (!company) {
            throw new ForbiddenException('Empresa não encontrada');
        }

        // 1. Verificar expiração
        if (company.expiresAt && new Date() > new Date(company.expiresAt)) {
            throw new ForbiddenException('Sua assinatura expirou. Renove para continuar utilizando o sistema.');
        }

        // 2. Verificar limites quantitativos
        if (resource === 'maxUsers') {
            const count = await this.prisma.user.count({ where: { companyId: user.companyId } });
            if (count >= company.maxUsers) {
                throw new ForbiddenException(`Limite de usuários atingido (${company.maxUsers}). Faça um upgrade no seu plano.`);
            }
        }

        if (resource === 'maxDepartments') {
            const count = await this.prisma.department.count({ where: { companyId: user.companyId } });
            if (count >= company.maxDepartments) {
                throw new ForbiddenException(`Limite de departamentos atingido (${company.maxDepartments}). Faça um upgrade no seu plano.`);
            }
        }

        if (resource === 'maxWhatsApp') {
            const count = await this.prisma.whatsAppInstance.count({ where: { companyId: user.companyId } });
            if (count >= company.maxWhatsApp) {
                throw new ForbiddenException(`Limite de conexões WhatsApp atingido (${company.maxWhatsApp}). Faça um upgrade no seu plano.`);
            }
        }

        return true;
    }
}
