import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredRoles) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();
        if (!user) return false;

        const roleStr = (user.role?.name || user.roleName || (typeof user.role === 'string' ? user.role : '')).toUpperCase();

        return requiredRoles.some((role) => {
            const req = role.toUpperCase();
            if (req === 'ADMIN' && (roleStr.includes('ADMIN') || roleStr.includes('GLOBAL'))) return true;
            if (req === 'SUPERVISOR' && roleStr.includes('SUPERVISOR')) return true;
            if (req === 'AGENT' && (roleStr.includes('ATENDENT') || roleStr.includes('AGENT'))) return true;

            return roleStr === req || roleStr.includes(req);
        });
    }
}
