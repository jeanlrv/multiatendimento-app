import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator';
import { Permission, ROLE_PERMISSIONS } from '../constants/permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredPermissions) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();

        if (!user) {
            throw new ForbiddenException('Usuário não autenticado');
        }

        // 1. Preferir permissões DB-driven do JWT (user.permissions[])
        // 2. Fallback ao mapa estático pelo nome do role (retrocompatibilidade)
        const roleName: string =
            typeof user.role === 'string' ? user.role : (user.role?.name ?? '');

        const userPermissions: string[] =
            Array.isArray(user.permissions) && user.permissions.length > 0
                ? user.permissions
                : (ROLE_PERMISSIONS[roleName.toUpperCase()] ??
                   ROLE_PERMISSIONS[roleName] ??
                   []);

        const hasPermission = requiredPermissions.every((permission) =>
            userPermissions.includes(permission),
        );

        if (!hasPermission) {
            throw new ForbiddenException(
                'Acesso negado: você não possui permissão para executar esta ação',
            );
        }

        return true;
    }
}
