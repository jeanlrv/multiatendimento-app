import { Injectable, CanActivate, ExecutionContext, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class MaintenanceGuard implements CanActivate {
    // Cache por empresa: 30s TTL para resposta rápida ao religar o sistema
    private readonly cache = new Map<string, { enabled: boolean; expiresAt: number }>();
    private readonly TTL_MS = 30_000;

    constructor(
        private readonly prisma: PrismaService,
        private readonly reflector: Reflector,
    ) {}

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        // Rotas públicas (@Public) sempre passam (webhooks, login, etc.)
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            ctx.getHandler(),
            ctx.getClass(),
        ]);
        if (isPublic) return true;

        const user = ctx.switchToHttp().getRequest().user;
        // JWT ainda não foi validado neste ciclo ou rota não autenticada — deixar passar
        if (!user?.companyId) return true;

        // ADMINs sempre acessam, mesmo em manutenção
        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;

        const { companyId } = user;
        const now = Date.now();
        const cached = this.cache.get(companyId);

        let enabled: boolean;
        if (cached && now < cached.expiresAt) {
            enabled = cached.enabled;
        } else {
            const s = await this.prisma.setting.findFirst({
                where: { companyId, key: 'maintenanceMode' },
                select: { value: true },
            });
            enabled = s?.value === 'true' || s?.value === '"true"';
            this.cache.set(companyId, { enabled, expiresAt: now + this.TTL_MS });
        }

        if (enabled)
            throw new ServiceUnavailableException('Sistema em manutenção. Tente novamente mais tarde.');

        return true;
    }
}
