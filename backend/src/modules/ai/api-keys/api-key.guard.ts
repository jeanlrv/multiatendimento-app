import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(private apiKeysService: ApiKeysService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const apiKeyHeader = request.headers['x-api-key'];

        if (!apiKeyHeader) {
            throw new UnauthorizedException('X-API-Key header is missing');
        }

        const apiKey = await this.apiKeysService.validateKey(apiKeyHeader);

        if (!apiKey) {
            throw new UnauthorizedException('Invalid or inactive API Key');
        }

        // Injetar informações da chave na request para uso no controller
        request.apiKeyCompanyId = apiKey.companyId;
        request.apiKeyAgentId = apiKey.agentId;

        return true;
    }
}
