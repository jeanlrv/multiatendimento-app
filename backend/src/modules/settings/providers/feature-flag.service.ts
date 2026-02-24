import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { createHash } from 'crypto';

@Injectable()
export class FeatureFlagService {
    private readonly logger = new Logger(FeatureFlagService.name);

    constructor(private readonly prisma: PrismaService) { }

    async isEnabled(flagKey: string, context: { tenantId?: string; userId?: string }): Promise<boolean> {
        const flag = await this.prisma.featureFlag.findUnique({
            where: { key: flagKey },
        });

        if (!flag) {
            this.logger.warn(`Feature flag ${flagKey} not found. Defaulting to false.`);
            return false;
        }

        if (!flag.isEnabled) return false;

        // 1. Exclusão explícita
        if (context.tenantId && flag.excludedTenants.includes(context.tenantId)) return false;

        // 2. Inclusão explícita
        if (context.tenantId && flag.targetTenants.includes(context.tenantId)) return true;

        // 3. Rollout Percentual
        if (flag.rolloutPercentage > 0 && context.tenantId) {
            return this.checkRollout(flag.key, context.tenantId, flag.rolloutPercentage);
        }

        // Se rollout for 0 e não estiver incluso explicitamente, retorna status base (que já é true aqui, mas seria weird se rollout=0 e isEnabled=true significasse 'all enabled' se não fosse por targetTenants.
        // Vamos assumir: Se isEnabled=true e rollout=0, então APENAS targetTenants.
        // Se rollout=100, todos (exceto excluded).
        // Se isEnabled=false, ninguem.

        // Correction on logic:
        // If isEnabled is true globally, check rollout.

        if (flag.rolloutPercentage === 0 && flag.targetTenants.length > 0) {
            return false; // Only targets
        }

        return true;
    }

    private checkRollout(key: string, identifier: string, percentage: number): boolean {
        const hash = createHash('md5').update(`${key}:${identifier}`).digest('hex');
        const value = parseInt(hash.substring(0, 4), 16);
        const normalized = value % 100;
        return normalized < percentage;
    }
}
