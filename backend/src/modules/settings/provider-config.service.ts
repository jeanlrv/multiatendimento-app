import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';
import { LLM_PROVIDERS } from '../ai/engine/llm-provider.factory';
import { EMBEDDING_PROVIDERS } from '../ai/engine/embedding-provider.factory';

export interface ProviderConfigInput {
    apiKey?: string;
    baseUrl?: string;
    extraConfig?: Record<string, any>;
    isEnabled?: boolean;
}

export interface ProviderConfigPublic {
    id: string;
    provider: string;
    category: string;
    apiKey: string | null;     // Mascarado para exibição
    baseUrl: string | null;
    extraConfig: any;
    isEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ProviderConfigDecrypted {
    provider: string;
    category: string;
    apiKey: string | null;
    baseUrl: string | null;
    extraConfig: any;
    isEnabled: boolean;
}

@Injectable()
export class ProviderConfigService {
    constructor(
        private prisma: PrismaService,
        private crypto: CryptoService,
    ) { }

    /** Retorna todos os configs da empresa com keys mascaradas */
    async findAllForCompany(companyId: string): Promise<ProviderConfigPublic[]> {
        const configs = await (this.prisma as any).providerConfig.findMany({
            where: { companyId },
            orderBy: { provider: 'asc' },
        });

        return configs.map((c: any) => this.maskConfig(c));
    }

    /** Salva (upsert) a configuração de um provider */
    async upsert(companyId: string, provider: string, data: ProviderConfigInput): Promise<ProviderConfigPublic> {
        const category = this.detectCategory(provider);

        const payload: any = {
            category,
            isEnabled: data.isEnabled ?? true,
            baseUrl: data.baseUrl || null,
            extraConfig: data.extraConfig || null,
        };

        // Encripta a API key somente se não for máscara (***) e não for string vazia
        if (data.apiKey && !data.apiKey.includes('***')) {
            payload.apiKey = this.crypto.encrypt(data.apiKey);
        } else if (data.apiKey === '' || data.apiKey === null) {
            payload.apiKey = null;
        }
        // Se data.apiKey contém '***', mantém o valor anterior (não sobrescreve)

        const config = await (this.prisma as any).providerConfig.upsert({
            where: { companyId_provider: { companyId, provider } },
            create: {
                companyId,
                provider,
                ...payload,
            },
            update: payload,
        });

        return this.maskConfig(config);
    }

    /** Remove a configuração de um provider */
    async remove(companyId: string, provider: string): Promise<void> {
        const existing = await (this.prisma as any).providerConfig.findFirst({
            where: { companyId, provider },
        });

        if (!existing) throw new NotFoundException(`Configuração do provider '${provider}' não encontrada.`);

        await (this.prisma as any).providerConfig.delete({
            where: { id: existing.id },
        });
    }

    /** Retorna configs descriptografados para uso interno (factories) */
    async getDecryptedForCompany(companyId: string): Promise<Map<string, ProviderConfigDecrypted>> {
        const configs = await (this.prisma as any).providerConfig.findMany({
            where: { companyId, isEnabled: true },
        });

        const result = new Map<string, ProviderConfigDecrypted>();

        for (const c of configs) {
            result.set(c.provider, {
                provider: c.provider,
                category: c.category,
                apiKey: c.apiKey ? this.crypto.decrypt(c.apiKey) : null,
                baseUrl: c.baseUrl || null,
                extraConfig: c.extraConfig || null,
                isEnabled: c.isEnabled,
            });
        }

        return result;
    }

    /** Retorna providers LLM disponíveis para uma empresa (DB + env vars) */
    async getAvailableLLMProviders(companyId: string, configService: any): Promise<{
        provider: string;
        providerName: string;
        models: { id: string; name: string; contextWindow?: number; multimodal?: boolean }[];
    }[]> {
        const companyConfigs = await this.getDecryptedForCompany(companyId);

        const { MULTIMODAL_MODELS } = require('../ai/engine/llm-provider.factory');

        return LLM_PROVIDERS.map(p => ({
            provider: p.id,
            providerName: p.name,
            models: p.models.map(m => ({
                ...m,
                multimodal: MULTIMODAL_MODELS.includes(m.id.split(':').pop() || m.id),
            })),
        }));
    }

    /** Retorna providers de embedding disponíveis para uma empresa (DB + env vars) */
    async getAvailableEmbeddingProviders(companyId: string, configService: any): Promise<{
        id: string;
        name: string;
        models: { id: string; name: string; dimensions: number }[];
    }[]> {
        return EMBEDDING_PROVIDERS.map(p => ({ id: p.id, name: p.name, models: p.models }));
    }

    /** Mascara a API key para exibição segura */
    private maskConfig(config: any): ProviderConfigPublic {
        return {
            id: config.id,
            provider: config.provider,
            category: config.category,
            apiKey: config.apiKey ? this.crypto.mask(config.apiKey) : null,
            baseUrl: config.baseUrl,
            extraConfig: config.extraConfig,
            isEnabled: config.isEnabled,
            createdAt: config.createdAt,
            updatedAt: config.updatedAt,
        };
    }

    /** Detecta a categoria do provider baseado no registry */
    private detectCategory(provider: string): string {
        const isLLM = LLM_PROVIDERS.some(p => p.id === provider);
        const isEmbedding = EMBEDDING_PROVIDERS.some(p => p.id === provider);

        if (isLLM && isEmbedding) return 'both';
        if (isEmbedding) return 'embedding';
        return 'llm';
    }
}
