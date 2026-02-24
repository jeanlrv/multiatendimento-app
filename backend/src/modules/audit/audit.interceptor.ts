import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
    constructor(private auditService: AuditService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const { method, url, user, ip, headers, body } = request;

        // Ações que queremos logar (normalmente mutações)
        const trackedMethods = ['POST', 'PATCH', 'PUT', 'DELETE'];

        if (!trackedMethods.includes(method) || !user) {
            return next.handle();
        }

        return next.handle().pipe(
            tap((data) => {
                // Extrair entidade da URL (ex: /api/users -> User)
                const parts = url.split('/');
                const entity = parts[2]?.charAt(0).toUpperCase() + parts[2]?.slice(1) || 'Unknown';

                this.auditService.log({
                    userId: user.id,
                    action: method,
                    entity: entity,
                    entityId: data?.id || body?.id || 'N/A',
                    changes: method === 'DELETE' ? body : data,
                    ipAddress: ip,
                    userAgent: headers['user-agent'],
                });
            }),
        );
    }
}
