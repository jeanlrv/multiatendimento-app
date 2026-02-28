import { Injectable, NotFoundException, Logger } from '@nestjs/common';
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
    private readonly logger = new Logger(ProviderConfigService.name);
    constructor(
        private prisma: PrismaService,
        private crypto: CryptoService,
    ) { }

    /** Retorna todos os configs da empresa com keys mascaradas */
    async findAllForCompany(companyId: string): Promise<ProviderConfigPublic[]> {
        try {
            const configs = await (this.prisma as any).providerConfig.findMany({
                where: { companyId },
                orderBy: { provider: 'asc' },
            });

            return configs.map((c: any) => this.maskConfig(c));
        } catch (error) {
            this.logger.error(`Erro ao buscar configurações de providers para empresa ${companyId}: ${error.message}`, error.stack);
            throw error;
        }
    }

    /** Salva (upsert) a configuração de um provider */
    async upsert(companyId: string, provider: string, data: ProviderConfigInput): Promise<ProviderConfigPublic> {
        try {
            this.logger.log(`Upsert de provider ${provider} para empresa ${companyId}`);
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

            const config = await (this.prisma as any).providerConfig.upsert({
                where: { companyId_provider: { companyId, provider } },
                create: {
                    companyId,
                    provider,
                    ...payload,
                },
                update: payload,
            });

            // Inválida quaisquer pipelines que precisem ser re-avaliados com os novos settings
            this.logger.log(`Upsert do provider ${provider} completo. O modelo selecionado foi atualizado no banco.`);

            return this.maskConfig(config);
        } catch (error) {
            this.logger.error(`Erro no upsert do provider ${provider} para empresa ${companyId}: ${error.message}`, error.stack);
            throw error;
        }
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
            try {
                result.set(c.provider, {
                    provider: c.provider,
                    category: c.category,
                    apiKey: c.apiKey ? this.crypto.decrypt(c.apiKey) : null,
                    baseUrl: c.baseUrl || null,
                    extraConfig: c.extraConfig || null,
                    isEnabled: c.isEnabled,
                });
            } catch (error) {
                this.logger.error(`Erro ao descriptografar provider ${c.provider} para empresa ${companyId}: ${error.message}`);
                // Pula este provider problemático mas continua carregando os outros
            }
        }

        return result;
    }

    async getAvailableLLMProviders(companyId: string): Promise<{
        provider: string;
        providerName: string;
        models: { id: string; name: string; contextWindow?: number; multimodal?: boolean }[];
    }[]> {
        const companyConfigs = await this.getDecryptedForCompany(companyId);
        const { MULTIMODAL_MODELS } = require('../ai/engine/llm-provider.factory');

        return LLM_PROVIDERS
            .filter(p => {
                const config = companyConfigs.get(p.id);
                return config && config.isEnabled;
            })
            .map(p => {
                const config = companyConfigs.get(p.id);
                const models = [...p.models];

                // Se houver um modelo customizado no extraConfig, filtra/adiciona ele como a ÚNICA/primeira opção
                if (config?.extraConfig?.model) {
                    const customModelId = `${p.id}:${config.extraConfig.model}`;

                    // Queremos expor APENAS o modelo selecionado para este provedor (se o user configurou no menu settings)
                    // Mas se o modelo configurado já existia na base do factory, nós o mantemos; se não, nós injetamos.
                    const existingModel = models.find(m => m.id === customModelId || m.name === config.extraConfig.model);

                    const filteredModels = existingModel
                        ? [existingModel]
                        : [{
                            id: customModelId,
                            name: `${config.extraConfig.model}`,
                            contextWindow: 128000 // default genérico para customizados
                        }];

                    this.logger.log(`Empresa ${companyId}: Filtrando modelos para ${p.id} -> [${filteredModels.map(m => m.name).join(', ')}]`);

                    return {
                        provider: p.id,
                        providerName: p.name,
                        models: filteredModels.map(m => ({
                            ...m,
                            multimodal: MULTIMODAL_MODELS.includes(m.id.split(':').pop() || m.id),
                        })),
                    };
                }

                this.logger.debug(`Empresa ${companyId}: Sem modelo específico para ${p.id}, retornando todos do factory.`);

                return {
                    provider: p.id,
                    providerName: p.name,
                    models: models.map(m => ({
                        ...m,
                        multimodal: MULTIMODAL_MODELS.includes(m.id.split(':').pop() || m.id),
                    })),
                };
            });
    }

    /** Retorna providers de embedding disponíveis para uma empresa (DB + env vars) */
    async getAvailableEmbeddingProviders(companyId: string, configService: any): Promise<{
        id: string;
        name: string;
        models: { id: string; name: string; dimensions: number }[];
    }[]> {
        const companyConfigs = await this.getDecryptedForCompany(companyId);

        return EMBEDDING_PROVIDERS
            .filter(p => {
                if (p.id === 'native') return true; // Sempre disponível
                try {
                    const config = companyConfigs.get(p.id);
                    return config && config.isEnabled;
                } catch {
                    return false;
                }
            })
            .map(p => {
                try {
                    const config = companyConfigs.get(p.id);
                    const models = [...p.models];

                    // Para AnythingLLM e Ollama, se houver modelo customizado, adicionar/ajustar
                    if (config?.extraConfig?.model && (p.id === 'anythingllm' || p.id === 'ollama')) {
                        const customId = `${p.id}:${config.extraConfig.model}`;
                        if (!models.some(m => m.id === customId)) {
                            models.unshift({
                                id: customId,
                                name: `${config.extraConfig.model} (Custom)`,
                                dimensions: p.id === 'anythingllm' ? 768 : 1024
                            });
                        }
                    }

                    return { id: p.id, name: p.name, models };
                } catch (error) {
                    this.logger.error(`Erro ao processar provider de embedding ${p.id}: ${error.message}`);
                    if (p.id === 'native') return { id: p.id, name: p.name, models: p.models };
                    return null;
                }
            })
            .filter(p => p !== null) as any;
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
