import { TenantGuard } from './tenant.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContext(user: any, isPublic = false): ExecutionContext {
    const mockReflector = {
        getAllAndOverride: jest.fn().mockReturnValue(isPublic),
    } as any;

    const guard = new TenantGuard(mockReflector);

    const mockRequest = { user };
    const mockContext = {
        switchToHttp: () => ({ getRequest: () => mockRequest }),
        getHandler: () => null,
        getClass: () => null,
    } as unknown as ExecutionContext;

    return mockContext;
}

// ── Suite ──────────────────────────────────────────────────────────────────────

describe('TenantGuard', () => {
    let guard: TenantGuard;
    let mockReflector: Reflector;

    beforeEach(() => {
        mockReflector = { getAllAndOverride: jest.fn() } as any;
        guard = new TenantGuard(mockReflector);
    });

    it('deve ser definido', () => {
        expect(guard).toBeDefined();
    });

    it('deve permitir rotas @Public() sem autenticação', async () => {
        (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(true);

        const ctx = {
            switchToHttp: () => ({ getRequest: () => ({ user: null }) }),
            getHandler: () => null,
            getClass: () => null,
        } as unknown as ExecutionContext;

        const result = await guard.canActivate(ctx);
        expect(result).toBe(true);
    });

    it('deve lançar UnauthorizedException quando user é null (sem JWT)', async () => {
        (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

        const ctx = {
            switchToHttp: () => ({ getRequest: () => ({ user: null }) }),
            getHandler: () => null,
            getClass: () => null,
        } as unknown as ExecutionContext;

        await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('deve lançar ForbiddenException quando user não tem companyId (multi-tenant crítico)', async () => {
        (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

        const ctx = {
            switchToHttp: () => ({
                getRequest: () => ({ user: { id: 'user-1', email: 'a@b.com', companyId: null } }),
            }),
            getHandler: () => null,
            getClass: () => null,
        } as unknown as ExecutionContext;

        await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('deve permitir usuário com companyId válido', async () => {
        (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

        const ctx = {
            switchToHttp: () => ({
                getRequest: () => ({
                    user: { id: 'user-1', email: 'a@b.com', companyId: 'company-abc' },
                }),
            }),
            getHandler: () => null,
            getClass: () => null,
        } as unknown as ExecutionContext;

        const result = await guard.canActivate(ctx);
        expect(result).toBe(true);
    });

    it('deve bloquear usuário com companyId de string vazia', async () => {
        (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

        const ctx = {
            switchToHttp: () => ({
                getRequest: () => ({ user: { id: 'user-1', companyId: '' } }),
            }),
            getHandler: () => null,
            getClass: () => null,
        } as unknown as ExecutionContext;

        await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
});
