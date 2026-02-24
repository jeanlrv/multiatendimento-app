import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator para extrair o companyId do usuário autenticado no request.
 * Assume que o request.user foi populado pelo JwtAuthGuard.
 */
export const Company = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.user?.companyId;
    },
);
