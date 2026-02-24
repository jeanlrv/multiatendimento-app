import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // 1. Verificar se a rota é pública
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        // 2. Verificar se o usuário está autenticado (populado pelo JwtAuthGuard)
        if (!user) {
            throw new UnauthorizedException('Usuário não autenticado no contexto do Tenant');
        }

        // 3. Verificar se o usuário possui um companyId vinculado
        if (!user.companyId) {
            throw new ForbiddenException('Usuário não possui uma empresa (Tenant) configurada');
        }

        // Nota: Futuramente podemos adicionar verificação se a empresa está ativa no DB aqui, 
        // ou validar se o companyId da rota (se houver) bate com o do usuário.

        return true;
    }
}
