import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { Permission } from '../constants/permissions';

// ── Helpers ──────────────────────────────────────────────────────────────────────

const buildContext = (user: any, permissions?: string[]): ExecutionContext => {
    const mockReflector = new Reflector();
    jest.spyOn(mockReflector, 'getAllAndOverride').mockReturnValue(permissions as any);

    const ctx = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
            getRequest: () => ({ user }),
        }),
    } as unknown as ExecutionContext;

    return ctx;
};

// ── Suite ──────────────────────────────────────────────────────────────────────

describe('PermissionsGuard', () => {
    let guard: PermissionsGuard;
    let reflector: Reflector;

    beforeEach(() => {
        reflector = new Reflector();
        guard = new PermissionsGuard(reflector);
    });

    it('deve permitir acesso quando rota não tem @Permissions()', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

        const ctx = {
            getHandler: jest.fn(),
            getClass: jest.fn(),
            switchToHttp: () => ({ getRequest: () => ({ user: { role: 'ADMIN' } }) }),
        } as unknown as ExecutionContext;

        expect(guard.canActivate(ctx)).toBe(true);
    });

    it('deve permitir acesso quando user tem todas as permissões requeridas', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.TICKETS_READ, Permission.TICKETS_CREATE]);

        const ctx = {
            getHandler: jest.fn(),
            getClass: jest.fn(),
            switchToHttp: () => ({
                getRequest: () => ({
                    user: {
                        role: 'AGENT',
                        permissions: [Permission.TICKETS_READ, Permission.TICKETS_CREATE, Permission.TICKETS_UPDATE],
                    },
                }),
            }),
        } as unknown as ExecutionContext;

        expect(guard.canActivate(ctx)).toBe(true);
    });

    it('deve negar acesso (ForbiddenException) quando user não tem permissão', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN_FULL']);

        const ctx = {
            getHandler: jest.fn(),
            getClass: jest.fn(),
            switchToHttp: () => ({
                getRequest: () => ({
                    user: {
                        role: 'AGENT',
                        permissions: [Permission.TICKETS_READ],
                    },
                }),
            }),
        } as unknown as ExecutionContext;

        expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('deve usar permissões do JWT (user.permissions[]) quando disponíveis', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['CUSTOM_PERM']);

        const ctx = {
            getHandler: jest.fn(),
            getClass: jest.fn(),
            switchToHttp: () => ({
                getRequest: () => ({
                    user: {
                        role: 'AGENT',
                        permissions: ['CUSTOM_PERM', 'OTHER_PERM'],
                    },
                }),
            }),
        } as unknown as ExecutionContext;

        // Deve usar user.permissions[] em vez do mapa estático
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it('deve usar fallback ao mapa estático quando JWT não tem permissions', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.TICKETS_READ]);

        const ctx = {
            getHandler: jest.fn(),
            getClass: jest.fn(),
            switchToHttp: () => ({
                getRequest: () => ({
                    user: {
                        role: 'ADMIN',
                        permissions: [], // vazio — fallback para ROLE_PERMISSIONS['ADMIN']
                    },
                }),
            }),
        } as unknown as ExecutionContext;

        // ADMIN no mapa estático deve ter TICKETS_READ
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it('deve lançar ForbiddenException quando user é null', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.TICKETS_READ]);

        const ctx = {
            getHandler: jest.fn(),
            getClass: jest.fn(),
            switchToHttp: () => ({
                getRequest: () => ({ user: null }),
            }),
        } as unknown as ExecutionContext;

        expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('deve lidar com role como objeto {name: "ADMIN"}', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.TICKETS_READ]);

        const ctx = {
            getHandler: jest.fn(),
            getClass: jest.fn(),
            switchToHttp: () => ({
                getRequest: () => ({
                    user: {
                        role: { name: 'ADMIN' },
                        permissions: [],
                    },
                }),
            }),
        } as unknown as ExecutionContext;

        expect(guard.canActivate(ctx)).toBe(true);
    });
});
