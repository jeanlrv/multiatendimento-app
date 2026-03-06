import { Injectable, Logger, ForbiddenException, NotFoundException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { CreateAIAgentDto } from './dto/create-ai-agent.dto';
import { UpdateAIAgentDto } from './dto/update-ai-agent.dto';
import { LLMService } from './engine/llm.service';
import { VectorStoreService } from './engine/vector-store.service';
import { ProviderConfigService } from '../settings/provider-config.service';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import * as FormData from 'form-data';

@Injectable()
export class AIService {
    private readonly logger = new Logger(AIService.name);

    /**
     * Model routing: quando o agente permite downgrade e a query é simples,
     * substitui modelos pesados por equivalentes econômicos.
     */
    private readonly MODEL_DOWNGRADE: Record<string, string> = {
        'gpt-4o': 'gpt-4o-mini',
        'gpt-4.1': 'gpt-4.1-mini',
        'claude-sonnet-4-20250514': 'claude-3-5-haiku-20241022',
        'claude-3-5-sonnet-20241022': 'claude-3-5-haiku-20241022',
        'gemini-1.5-pro': 'gemini-2.0-flash',
        'mistral-large-latest': 'mistral-small-latest',
        'deepseek-reasoner': 'deepseek-chat',
        'cohere:command-r-plus': 'cohere:command-r',
    };

    constructor(
        private prisma: PrismaService,
        private llmService: LLMService,
        private vectorStoreService: VectorStoreService,
        private providerConfigService: ProviderConfigService,
        private eventEmitter: EventEmitter2,
    ) { }

    // AIAgent CRUD
    async createAgent(companyId: string, data: CreateAIAgentDto) {
        return (this.prisma as any).aIAgent.create({
            data: {
                ...data,
                companyId,
                embedId: uuidv4()
            }
        });
    }

    async findAllAgents(companyId: string) {
        return (this.prisma as any).aIAgent.findMany({
            where: { companyId }
        });
    }

    async findOneAgent(companyId: string, id: string) {
        return (this.prisma as any).aIAgent.findFirst({
            where: { id, companyId }
        });
    }

    async updateAgent(companyId: string, id: string, data: UpdateAIAgentDto) {
        // Verifica que o agente pertence à empresa antes de atualizar
        const agent = await this.findOneAgent(companyId, id);
        if (!agent) throw new NotFoundException('Agente não encontrado');

        // Spread para plain object — evita problemas de class-transformer passando instância de classe para o Prisma
        const updateData = { ...data };

        // Se o agente não tiver um embedId ainda, gera um agora
        if (!agent.embedId) {
            (updateData as any).embedId = uuidv4();
        }

        return (this.prisma as any).aIAgent.update({
            where: { id },
            data: updateData
        });
    }

    async removeAgent(companyId: string, id: string) {
        return (this.prisma as any).aIAgent.deleteMany({
            where: { id, companyId }
        });
    }

    private semanticCache = new Map<string, { embedding: number[], response: string, timestamp: number }>();
    private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora — evita respostas obsoletas após atualização da base

    /** Custo estimado por 1.000 tokens de entrada (USD) — para rastreamento de custo */
    private readonly COST_INPUT: Record<string, number> = {
        'gpt-4o-mini': 0.00015, 'gpt-4o': 0.005,
        'claude-3-5-sonnet-20241022': 0.003, 'claude-3-5-haiku-20241022': 0.0008,
        'claude-3-opus-20240229': 0.015,
        'gemini-2.0-flash': 0.0001, 'gemini-1.5-pro': 0.00125,
        'deepseek-chat': 0.00027, 'deepseek-reasoner': 0.00055,
        'llama-3.1-8b-instant': 0.00005, 'llama-3.1-70b-versatile': 0.00059,
        'mistral-large-latest': 0.002,
    };
    private readonly COST_OUTPUT: Record<string, number> = {
        'gpt-4o-mini': 0.0006, 'gpt-4o': 0.015,
        'claude-3-5-sonnet-20241022': 0.015, 'claude-3-5-haiku-20241022': 0.004,
        'claude-3-opus-20240229': 0.075,
        'gemini-2.0-flash': 0.0004, 'gemini-1.5-pro': 0.005,
        'deepseek-chat': 0.00110, 'deepseek-reasoner': 0.00219,
        'llama-3.1-8b-instant': 0.00008, 'llama-3.1-70b-versatile': 0.00079,
        'mistral-large-latest': 0.006,
    };

    /** Tamanho máximo de contexto por modelo (em chars ≈ tokens × 3.5) */
    private readonly MODEL_CONTEXT_CHARS: Record<string, number> = {
        'gpt-4o-mini': 128000 * 3, 'gpt-4o': 128000 * 3,
        'claude-3-5-sonnet-20241022': 200000 * 3, 'claude-3-5-haiku-20241022': 200000 * 3,
        'gemini-2.0-flash': 1000000 * 3, 'gemini-1.5-pro': 1000000 * 3,
        'deepseek-chat': 64000 * 3, 'deepseek-reasoner': 64000 * 3,
    };
    private readonly DEFAULT_MAX_CONTEXT_CHARS = 30000; // ~8k tokens, seguro para modelos desconhecidos

    /** Invalidação de cache semântico + RAG quando a base de conhecimento é atualizada */
    @OnEvent('knowledge.updated')
    handleKnowledgeUpdated(payload: { knowledgeBaseId: string; companyId: string }) {
        const before = this.semanticCache.size;
        this.semanticCache.clear();
        this.vectorStoreService.invalidateRagCache(payload.knowledgeBaseId, payload.companyId);
        this.logger.log(`[Cache] Cache semântico + RAG limpos após atualização da KB ${payload.knowledgeBaseId} (${before} entradas removidas)`);
    }

    /**
     * Verifica se o custo diário da empresa ultrapassou o limite configurado.
     * Emite uma notificação de alerta se o threshold for excedido (fire-and-forget).
     */
    private async checkCostAlert(companyId: string, estimatedCost: number): Promise<void> {
        try {
            const company = await (this.prisma as any).company.findUnique({
                where: { id: companyId },
                select: { dailyCostAlertUsd: true },
            });
            if (!company?.dailyCostAlertUsd || company.dailyCostAlertUsd <= 0) return;

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const dailyCost = await (this.prisma as any).aIUsage.aggregate({
                where: { companyId, createdAt: { gte: startOfDay } },
                _sum: { cost: true },
            });
            const totalDailyCost = (dailyCost._sum.cost ?? 0) + estimatedCost;
            if (totalDailyCost >= company.dailyCostAlertUsd) {
                // Cria notificação de alerta no banco (deduplicada: apenas uma por dia)
                const existingAlert = await (this.prisma as any).notification.findFirst({
                    where: {
                        companyId,
                        event: 'ai.cost_alert',
                        createdAt: { gte: startOfDay },
                    },
                });
                if (!existingAlert) {
                    await (this.prisma as any).notification.create({
                        data: {
                            companyId,
                            type: 'WARNING',
                            event: 'ai.cost_alert',
                            title: 'Alerta de custo de IA',
                            body: `O custo diário de IA atingiu $${totalDailyCost.toFixed(4)} (limite: $${company.dailyCostAlertUsd.toFixed(4)}).`,
                            data: { totalDailyCost, threshold: company.dailyCostAlertUsd },
                        },
                    });
                    this.eventEmitter.emit('ai.cost_alert', { companyId, totalDailyCost, threshold: company.dailyCostAlertUsd });
                    this.logger.warn(`[CostAlert] Empresa ${companyId}: custo diário $${totalDailyCost.toFixed(4)} ≥ limite $${company.dailyCostAlertUsd}`);
                }
            }
        } catch (e) {
            this.logger.warn(`[CostAlert] Falha ao verificar alerta de custo: ${e.message}`);
        }
    }

    /**
     * Sumarização progressiva: quando uma conversa atinge 30+ mensagens,
     * gera um resumo comprimido de forma assíncrona (fire-and-forget).
     * O resumo é armazenado em Conversation.summary e injetado no system prompt nas próximas chamadas.
     */
    private triggerProgressiveSummarization(
        conversationId: string,
        companyId: string,
        agentId: string,
        history: any[],
        existingSummary?: string,
    ): void {
        // Executa de forma assíncrona sem bloquear a resposta ao usuário
        setImmediate(async () => {
            try {
                const agent = await this.findOneAgent(companyId, agentId);
                if (!agent?.isActive) return;

                const modelId = agent.modelId || 'gpt-4o-mini';
                const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
                const llmConfig = companyConfigs.get(this.detectProviderFromModelId(modelId));

                // Compõe texto a resumir: resumo anterior (se houver) + histórico recente
                const contextText = existingSummary
                    ? `Resumo anterior: ${existingSummary}\n\nMensagens recentes:\n`
                    : 'Mensagens da conversa:\n';
                const historyText = history
                    .slice(-20) // últimas 20 mensagens
                    .map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`)
                    .join('\n');

                const summary = await this.llmService.generateResponse(
                    modelId,
                    'Você é um assistente que cria resumos concisos de conversas. Responda apenas com o resumo, sem prefixos ou comentários.',
                    `${contextText}${historyText}\n\nResuma os pontos principais desta conversa em no máximo 5 frases.`,
                    [], 0.3, undefined,
                    llmConfig?.apiKey || undefined,
                    llmConfig?.baseUrl || undefined,
                );

                await (this.prisma as any).conversation.updateMany({
                    where: { id: conversationId, companyId },
                    data: {
                        summary,
                        summaryMessageCount: history.length,
                    },
                });
                this.logger.log(`[Summarization] Conversa ${conversationId} resumida (${history.length} msgs → ${summary.length} chars)`);
            } catch (e) {
                this.logger.warn(`[Summarization] Falha ao sumarizar conversa ${conversationId}: ${e.message}`);
            }
        });
    }

    /** FASE 3/7 - Compressor de Contexto histórico (com preservação de contexto inicial) */
    private compressContext(history: any[], maxMessages = 20) {
        if (!history || history.length === 0) return [];
        const FILLER_WORDS = new Set(['ok', 'obrigado', 'obrigada', 'valeu', 'sim', 'nao', 'não', 'tchau']);
        const compressed = history.filter((h, index) => {
            const text = h.content?.trim()?.toLowerCase() ?? '';
            // Remove mensagens curtas de preenchimento (exceto a última)
            if (index < history.length - 1 && FILLER_WORDS.has(text)) return false;
            return true;
        });

        // Agrupa mensagens consecutivas do mesmo role para economizar tokens
        const grouped: any[] = [];
        for (const h of compressed) {
            if (grouped.length > 0 && grouped[grouped.length - 1].role === h.role) {
                grouped[grouped.length - 1].content += '\n' + h.content;
            } else {
                grouped.push({ ...h });
            }
        }

        // Se ainda acima do limite: mantém as 2 primeiras (contexto inicial) + últimas N-2
        // Isso preserva o contexto de abertura da conversa enquanto descarta o meio menos relevante
        if (grouped.length > maxMessages) {
            return [...grouped.slice(0, 2), ...grouped.slice(-(maxMessages - 2))];
        }
        return grouped;
    }

    private allocateTokenBudget(message: string): { chunkLimit: number } {
        const charCount = message.length;
        const wordCount = message.trim().split(/\s+/).length;
        // Budget maior para queries mais longas ou complexas
        if (charCount > 300 || wordCount > 50) {
            return { chunkLimit: 20 }; // Query longa/complexa: mais contexto
        }
        if (charCount > 100 || wordCount > 15) {
            return { chunkLimit: 15 }; // Query média
        }
        return { chunkLimit: 10 };    // Query curta: ainda assim contexto razoável
    }

    /** Guarda contra overflow de context window: trunca o contexto RAG se necessário */
    private guardContextOverflow(systemPrompt: string, context: string, history: any[], message: string, modelId: string): string {
        const maxChars = this.MODEL_CONTEXT_CHARS[modelId] ?? this.DEFAULT_MAX_CONTEXT_CHARS;
        const fixedChars = systemPrompt.length + message.length +
            history.reduce((s, h) => s + (h.content?.length || 0), 0);
        const budgetForContext = maxChars * 0.5 - fixedChars; // máx 50% do contexto para RAG
        if (budgetForContext <= 0) return '';
        if (context.length > budgetForContext) {
            this.logger.warn(`[ContextOverflow] Contexto RAG truncado de ${context.length} para ${budgetForContext} chars (modelo: ${modelId})`);
            return context.substring(0, budgetForContext);
        }
        return context;
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom === 0 ? 0 : dot / denom;
    }

    /**
     * Verifica limites de tokens da empresa (hora, dia, total).
     * Lança ForbiddenException se algum limite for atingido.
     * 0 = Ilimitado.
     */
    private async checkTokenLimits(companyId: string, agentId?: string) {
        const [company, agent] = await Promise.all([
            (this.prisma as any).company.findUnique({
                where: { id: companyId },
                select: { limitTokens: true, limitTokensPerHour: true, limitTokensPerDay: true }
            }),
            agentId ? (this.prisma as any).aIAgent.findUnique({
                where: { id: agentId },
                select: { limitTokensPerDay: true }
            }) : null
        ]);

        if (!company) return;

        const now = new Date();
        const startOfHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

        const [hourlyUsage, dailyUsage, totalTokens] = await Promise.all([
            (this.prisma as any).aIUsage.aggregate({
                where: { companyId, createdAt: { gte: startOfHour } },
                _sum: { tokens: true }
            }),
            (this.prisma as any).aIUsage.aggregate({
                where: { companyId, createdAt: { gte: startOfDay } },
                _sum: { tokens: true }
            }),
            (this.prisma as any).aIUsage.aggregate({
                where: { companyId },
                _sum: { tokens: true }
            }),
        ]);

        const hourlyTokens = hourlyUsage._sum.tokens || 0;
        const dailyTokens = dailyUsage._sum.tokens || 0;
        const totalTokensUsed = totalTokens._sum.tokens || 0;

        // Regra "0 = Ilimitado" em todos os campos
        if (company.limitTokensPerHour > 0 && hourlyTokens >= company.limitTokensPerHour) {
            throw new ForbiddenException(`Limite de tokens por hora atingido (${company.limitTokensPerHour}). Tente novamente mais tarde.`);
        }

        // Verifica o limite diário (menor entre Agente e Empresa, se > 0)
        let effectiveDayLimit = company.limitTokensPerDay;
        if (agent && agent.limitTokensPerDay > 0) {
            effectiveDayLimit = (effectiveDayLimit > 0)
                ? Math.min(effectiveDayLimit, agent.limitTokensPerDay)
                : agent.limitTokensPerDay;
        }

        if (effectiveDayLimit > 0 && dailyTokens >= effectiveDayLimit) {
            throw new ForbiddenException(`Limite de tokens por dia atingido (${effectiveDayLimit}). Tente novamente amanhã.`);
        }

        if (company.limitTokens > 0 && totalTokensUsed >= company.limitTokens) {
            throw new ForbiddenException(`Limite total de tokens de IA atingido (${company.limitTokens}). Entre em contato com o suporte.`);
        }
    }

    /**
     * Motor de Chat Nativo: Usa LangChain com suporte multi-provider.
     * @param conversationId ID da conversa no playground (opcional) — habilita sumarização progressiva.
     */
    async chat(companyId: string, agentId: string, message: string, history: any[] = [], conversationId?: string) {
        if (!message || message.trim().length === 0) {
            throw new BadRequestException('Mensagem não pode ser vazia');
        }
        if (message.length > 4000) message = message.substring(0, 4000);

        // Fase 3 e 7: Compressor de Contexto (preserva 2 primeiras + últimas 18)
        history = this.compressContext(history);

        const agent = await this.findOneAgent(companyId, agentId);
        if (!agent || !agent.isActive) {
            throw new NotFoundException('Agente não encontrado ou inativo');
        }

        try {
            await this.checkTokenLimits(companyId, agentId);
            // Fase 5: Semantic Cache (Interceptação por Vector)
            let promptEmbedding: number[] = [];
            try {
                const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
                const embeddingProvider = agent.embeddingProvider || 'qwen';
                const embeddingConfig = companyConfigs.get(embeddingProvider);

                // Evita carregar o modelo nativo (@xenova) para cache se não for estritamente necessário
                // ou se o ambiente estiver em modo de economia de memória (Railway 512MB)
                promptEmbedding = await this.vectorStoreService.generateEmbedding(
                    message,
                    embeddingProvider,
                    agent.embeddingModel,
                    embeddingConfig?.apiKey || undefined,
                    embeddingConfig?.baseUrl || undefined
                );

                const cacheKeyPrefix = `${companyId}:${agentId}:`;
                for (const [key, cached] of this.semanticCache.entries()) {
                    if (key.startsWith(cacheKeyPrefix)) {
                        if (Date.now() - cached.timestamp > this.CACHE_TTL_MS) { this.semanticCache.delete(key); continue; }
                        if (this.cosineSimilarity(promptEmbedding, cached.embedding) > 0.95) {
                            this.logger.log(`[Cache HIT] Similarity > 0.95 para agente ${agent.name}`);
                            return cached.response;
                        }
                    }
                }
            } catch (error) {
                this.logger.debug(`[Cache Skip] Falha ao verificar cache semântico (possível timeout ou OOM): ${error.message}`);
                /* fallback: avança sem cache */
            }

            // Fase 4: Token Budget Manager
            const budget = this.allocateTokenBudget(message);
            let finalModelId = agent.modelId || 'gpt-4o-mini';

            // Model routing: downgrade para modelo econômico em queries simples
            if (agent.allowModelDowngrade && budget.chunkLimit === 2 && this.MODEL_DOWNGRADE[finalModelId]) {
                const downgraded = this.MODEL_DOWNGRADE[finalModelId];
                this.logger.debug(`[ModelRouting] Downgrade: ${finalModelId} → ${downgraded} (query simples)`);
                finalModelId = downgraded;
            }

            this.logger.log(`Chat "${agent.name}" | modelo: ${finalModelId} | chunks: ${budget.chunkLimit}`);

            const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
            const providerId = this.detectProviderFromModelId(finalModelId);
            const llmConfig = companyConfigs.get(providerId);

            // Validação de Provider LLM
            if (!llmConfig && providerId !== 'ollama' && providerId !== 'lmstudio') {
                this.logger.warn(`[Chat] Configuração ausente para provider '${providerId}' (empresa: ${companyId})`);
                throw new BadRequestException(`O provider '${providerId}' não está configurado ou habilitado. Configure em Configurações > IA & Modelos.`);
            }

            const embeddingProvider = agent.embeddingProvider || 'openai';
            const embeddingConfig = companyConfigs.get(embeddingProvider);

            // Validação de Provider de Embedding (exceto nativo)
            if (embeddingProvider !== 'native' && !embeddingConfig && embeddingProvider !== 'ollama' && embeddingProvider !== 'anythingllm') {
                this.logger.warn(`[Chat] Configuração de embedding ausente para provider '${embeddingProvider}'`);
                // Não trava o chat se for apenas embedding mas avisa
            }

            // Sumarização progressiva: carrega resumo da conversa se disponível
            let conversationSummary: string | undefined;
            if (conversationId) {
                const conv = await (this.prisma as any).conversation.findFirst({
                    where: { id: conversationId, companyId },
                    select: { summary: true, summaryMessageCount: true },
                });
                conversationSummary = conv?.summary ?? undefined;
            }

            // RAG: usa o embeddingProvider da knowledge base (não do agente),
            // pois os chunks foram indexados com o provider da KB.
            let context = '';
            if (agent.knowledgeBaseId) {
                const kb = await (this.prisma as any).knowledgeBase.findUnique({
                    where: { id: agent.knowledgeBaseId },
                    select: { language: true, embeddingProvider: true, embeddingModel: true },
                });
                // Provider e modelo usados para indexar — devem ser os mesmos usados na busca
                const kbEmbeddingProvider = kb?.embeddingProvider || agent.embeddingProvider || 'native';
                const kbEmbeddingModel = kb?.embeddingModel || agent.embeddingModel || 'all-MiniLM-L6-v2';
                const kbEmbeddingConfig = companyConfigs.get(kbEmbeddingProvider);

                this.logger.debug(`[RAG] Buscando base ${agent.knowledgeBaseId} com provider="${kbEmbeddingProvider}" model="${kbEmbeddingModel}"`);

                const chunks = await this.vectorStoreService.searchSimilarity(
                    this.prisma, companyId, message, agent.knowledgeBaseId,
                    budget.chunkLimit, kbEmbeddingProvider,
                    kbEmbeddingModel, kbEmbeddingConfig?.apiKey || undefined,
                    kbEmbeddingConfig?.baseUrl || undefined,
                    kb?.language || 'portuguese',
                );
                context = chunks.map(c => c.content).join('\n---\n');
                this.logger.log(`[RAG] ${chunks.length} chunks retornados para contexto na KB ${agent.knowledgeBaseId}.`);
            } else {
                this.logger.log(`[RAG] Ignorado. Agente ${agent.name} não possui knowledgeBaseId configurado.`);
            }

            // Overflow guard: trunca RAG se context window exceder limite do modelo
            context = this.guardContextOverflow(agent.prompt || '', context, history, message, finalModelId);

            // Injeta resumo da conversa no system prompt (se houver)
            let systemPrompt = conversationSummary
                ? `${agent.prompt || 'Você é um assistente virtual prestativo.'}\n\n[Resumo da conversa até agora]: ${conversationSummary}`
                : (agent.prompt || 'Você é um assistente virtual prestativo.');

            // Adiciona instrução de grounding (RAG) se houver contexto
            if (context) {
                // Parsear chunks com formatação [SOURCE_N] para melhor prompt do LLM
                const sourceChunks = context.split('\n---\n').map((chunk, index) => {
                    // Extrair metadata se presente (干ar line com Similaridade)
                    const lines = chunk.split('\n').filter(line => line.trim());
                    const contentStart = lines[0].startsWith('Similaridade') ? 1 : 0;
                    return {
                        number: index + 1,
                        content: lines.slice(contentStart).join('\n').trim(),
                    };
                }).filter(c => c.content.length > 50); // Filtrar chunks muito curtos

                const formattedContext = sourceChunks
                    .map(c => `[SOURCE_${c.number}]\n${c.content}\n[END_SOURCE_${c.number}]`)
                    .join('\n\n');

                systemPrompt += [
                    '',
                    '========================================',
                    '[BASE DE CONHECIMENTO PARA RAG]',
                    '========================================',
                    '',
                    'Você é um assistente especializado que responde EXCLUSIVAMENTE com base na base de conhecimento abaixo.',
                    'SEUS OBRIGAÇÕES:',
                    '',
                    '1. [OBRIGATÓRIO] Use APENAS as informações contidas nas SOURCEs abaixo para fundamentar sua resposta.',
                    '2. [OBRIGATÓRIO] Cite a SOURCE específica (ex: "Conforme SOURCE_1") sempre que usar informações do contexto.',
                    '3. [OBRIGATÓRIO] Se a resposta estiver parcialmente nas SOURCEs, use-a e complemente apenas com conhecimento geral CLARO.',
                    '4. [OBRIGATÓRIO] Se a informação NÃO estiver em NENHUMA SOURCE, diga: "Não encontrei informações sobre isso na base de conhecimento."',
                    '5. [NÃO FAÇA] NÃO invente dados, números, URLs ou fatos que não estejam nas SOURCEs.',
                    '6. [NÃO FAÇA] NÃO adivinhe ou especule sobre informações ausentes.',
                    '',
                    'FORMATO DE RESPOSTA:',
                    '- Use parágrafos curtos e objetivos.',
                    '- Referencie SOURCEs usando [SOURCE_N] dentro do texto quando relevante.',
                    '- Se múltiplas SOURCEs apoiarem o mesmo ponto, cite todas (ex: [SOURCE_1, SOURCE_3]).',
                    '',
                    'FONTES (contexto recuperado via busca semântica):',
                    formattedContext,
                    '========================================',
                ].join('\n');
                // Limpa o contexto da variável enviada diretamente ao llmService para evitar duplicação
                context = '';
            }

            const response = await this.llmService.generateResponse(
                finalModelId,
                systemPrompt,
                message,
                history.map(h => ({
                    role: (h.role === 'user' || h.role === 'client' ? 'user' : 'assistant') as 'user' | 'assistant',
                    content: h.content,
                })),
                agent.temperature || 0.7,
                context,
                llmConfig?.apiKey || undefined,
                llmConfig?.baseUrl || undefined,
            );

            // Sumarização progressiva: dispara assincronamente quando a conversa tem 30+ mensagens
            if (conversationId && history.length >= 30) {
                this.triggerProgressiveSummarization(conversationId, companyId, agentId, history, conversationSummary);
            }

            // Grava RAG Cache
            if (promptEmbedding.length > 0) {
                const newCacheKey = `${companyId}:${agentId}:${Date.now()}`;
                this.semanticCache.set(newCacheKey, { embedding: promptEmbedding, response, timestamp: Date.now() });
                if (this.semanticCache.size > 2000) {
                    const firstKey = this.semanticCache.keys().next().value;
                    if (firstKey) this.semanticCache.delete(firstKey);
                }
            }

            try {
                await this.trackTokenUsage(companyId, finalModelId, agent.prompt || '', context, history, response, 0);
            } catch (e) {
                this.logger.warn(`Falha ao registrar uso de tokens: ${e.message}`);
            }

            return response;
        } catch (error) {
            this.logger.error(`Erro no chat: ${error.message}`, error.stack);
            // Re-lança exceções HTTP do NestJS (BadRequest, Forbidden, NotFound…) sem modificá-las
            if (error?.status && error?.response) throw error;
            // Converte erros genéricos (LLM API, Prisma, network) em 503 legível pelo frontend
            const msg = error?.message || 'Erro interno ao processar mensagem';
            throw new ServiceUnavailableException(
                `Falha ao processar resposta da IA: ${msg}. Verifique se a API Key e o modelo estão corretos em Configurações → IA & Modelos.`
            );
        }
    }

    /**
     * Chat multimodal com suporte a imagens
     */
    async chatMultimodal(
        companyId: string,
        agentId: string,
        message: string,
        imageUrls: string[] = [],
        history: any[] = []
    ) {
        if (!message || message.trim().length === 0) {
            throw new BadRequestException('Mensagem não pode ser vazia');
        }
        if (message.length > 4000) message = message.substring(0, 4000);

        // Fase 3 e 7: Compressor de Contexto
        history = this.compressContext(history);

        if (imageUrls.length > 5) {
            throw new BadRequestException('Máximo de 5 imagens por requisição');
        }

        const agent = await this.findOneAgent(companyId, agentId);
        if (!agent || !agent.isActive) {
            throw new NotFoundException('Agente não encontrado ou inativo');
        }

        await this.checkTokenLimits(companyId, agentId);

        try {
            // Fase 5: Semantic Cache (Apenas aplicável se não houver imagens na rodada)
            let promptEmbedding: number[] = [];
            if (imageUrls.length === 0) {
                try {
                    promptEmbedding = await this.vectorStoreService.generateEmbedding(message, 'qwen');
                    const cacheKeyPrefix = `${companyId}:${agentId}-mm:`;
                    for (const [key, cached] of this.semanticCache.entries()) {
                        if (key.startsWith(cacheKeyPrefix)) {
                            // Evict entradas expiradas
                            if (Date.now() - cached.timestamp > this.CACHE_TTL_MS) {
                                this.semanticCache.delete(key);
                                continue;
                            }
                            if (this.cosineSimilarity(promptEmbedding, cached.embedding) > 0.95) {
                                this.logger.log(`[Cache HIT] Semantic similarity > 0.95 (MM) abortando geração para agente ${agent.name}`);
                                return cached.response;
                            }
                        }
                    }
                } catch (err) { }
            }

            // Fase 4 e 6: Token Budget Manager
            const budget = this.allocateTokenBudget(message);
            let finalModelId = agent.modelId || 'gpt-4o-mini';

            this.logger.log(`Chat multimodal com agente "${agent.name}" usando modelo: ${finalModelId} | Budget limit: ${budget.chunkLimit}`);

            const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
            const llmProviderId = this.detectProviderFromModelId(finalModelId);
            const llmConfig = companyConfigs.get(llmProviderId);

            const response = await this.llmService.generateMultimodalResponse(
                finalModelId,
                agent.prompt || 'Você é um assistente virtual prestativo.',
                message,
                imageUrls,
                history.map(h => ({
                    role: h.role === 'user' || h.role === 'client' ? 'user' : 'assistant',
                    content: h.content
                })),
                agent.temperature || 0.7,
                llmConfig?.apiKey || undefined,
                llmConfig?.baseUrl || undefined,
            );

            // Grava RAG Cache
            if (promptEmbedding.length > 0 && imageUrls.length === 0) {
                const newCacheKey = `${companyId}:${agentId}-mm:${Date.now()}`;
                this.semanticCache.set(newCacheKey, { embedding: promptEmbedding, response, timestamp: Date.now() });
                if (this.semanticCache.size > 2000) {
                    const firstKey = this.semanticCache.keys().next().value;
                    if (firstKey) this.semanticCache.delete(firstKey);
                }
            }

            // Registrar uso de tokens (estimativa maior para multimodal)
            try {
                await this.trackTokenUsage(companyId, finalModelId, agent.prompt || '', '', history, response, imageUrls.length);
            } catch (e) {
                this.logger.warn(`Falha ao registrar uso de tokens: ${e.message}`);
            }

            return response;
        } catch (error) {
            this.logger.error(`Erro no chat multimodal: ${error.message}`, error.stack);
            if (error?.status && error?.response) throw error;
            const msg = error?.message || 'Erro interno ao processar mensagem';
            throw new ServiceUnavailableException(
                `Falha ao processar resposta multimodal: ${msg}. Verifique se o modelo suporta imagens e a API Key está correta.`
            );
        }
    }

    /**
     * Consulta a base de conhecimento e gera resposta usando contexto recuperado
     */
    async queryKnowledgeBase(
        companyId: string,
        agentId: string,
        query: string,
        knowledgeBaseId: string,
        options?: {
            maxChunks?: number;
            minScore?: number;
            temperature?: number;
        }
    ): Promise<{ response: string; sources: any[]; usage?: any }> {
        const agent = await this.prisma.aIAgent.findFirst({
            where: { id: agentId, companyId }
        });

        if (!agent) {
            throw new NotFoundException('Agente não encontrado');
        }

        // Buscar chunks relevantes na base de conhecimento
        // Usar o provider da KB (não do agente), pois os chunks foram indexados com o provider da KB.
        const kb = await (this.prisma as any).knowledgeBase.findUnique({
            where: { id: knowledgeBaseId },
            select: { language: true, embeddingProvider: true, embeddingModel: true },
        });
        const kbEmbeddingProvider = kb?.embeddingProvider || agent.embeddingProvider || 'native';
        const kbEmbeddingModel = kb?.embeddingModel || agent.embeddingModel || 'all-MiniLM-L6-v2';

        const relevantChunks = await this.vectorStoreService.searchSimilarity(
            this.prisma,
            companyId,
            query,
            knowledgeBaseId,
            options?.maxChunks || 5,
            kbEmbeddingProvider,
            kbEmbeddingModel,
            undefined, // apiKey será buscada automaticamente
            undefined, // baseUrl será buscado automaticamente
            kb?.language || 'portuguese'
        );

        // Filtrar chunks por score mínimo se especificado
        const filteredChunks = options?.minScore
            ? relevantChunks.filter(chunk => chunk.score >= (options.minScore || 0.3))
            : relevantChunks;

        if (filteredChunks.length === 0) {
            // Caso não encontre conteúdo relevante, responder com informação padrão
            return {
                response: "Não encontrei informações relevantes na base de conhecimento para responder a essa pergunta.",
                sources: [],
                usage: { inputTokens: query.length, outputTokens: 0 }
            };
        }

        // Construir contexto a partir dos chunks recuperados
        const context = filteredChunks.map((chunk, index) =>
            `Fonte ${index + 1} (Similaridade: ${(chunk.score * 100).toFixed(1)}%):\n${chunk.content}`
        ).join('\n\n---\n\n');

        // Criar prompt otimizado para uso do contexto
        const enhancedPrompt = `Você é um assistente especializado que responde perguntas com base na base de conhecimento fornecida.

Instruções:
- Use APENAS as informações contidas no contexto abaixo para responder
- Se a resposta não estiver no contexto, diga que não encontrou informações suficientes
- Cite as fontes quando possível
- Seja conciso e direto, mas forneça detalhes relevantes

Contexto da base de conhecimento:
${context}

Pergunta: ${query}

Resposta:`;

        try {
            const response = await this.chat(
                companyId,
                agentId,
                enhancedPrompt,
                [], // sem histórico — query direta à base de conhecimento
            );

            return {
                response,
                sources: filteredChunks,
                usage: {
                    inputTokens: enhancedPrompt.length,
                    outputTokens: response.length,
                    contextChunks: filteredChunks.length
                }
            };
        } catch (error) {
            this.logger.error(`Erro ao consultar base de conhecimento: ${error.message}`);
            throw error;
        }
    }

    /**
     * Registra uso de tokens na tabela AIUsage.
     * Estima tokens de entrada (prompt + contexto RAG + histórico) e saída (~4 chars/token).
     * Calcula custo estimado em USD com base nas tabelas de preço de cada provider.
     */
    private async trackTokenUsage(
        companyId: string,
        modelId: string,
        systemPrompt: string,
        context: string,
        history: any[],
        response: string,
        imageCount: number = 0,
    ) {
        const historyChars = history.reduce((sum, h) => sum + (h.content?.length || 0), 0);
        const inputTokens = Math.ceil((systemPrompt.length + context.length + historyChars) / 4);
        const outputTokens = Math.ceil(response.length / 4);
        // ~500 tokens por imagem (estimativa conservadora para visão gpt-4o/claude)
        const imageTokens = imageCount * 500;
        const estimatedTokens = inputTokens + outputTokens + imageTokens;

        // Custo estimado: usa o modelId sem prefixo de provider (ex: 'groq:llama-3.1-8b' → 'llama-3.1-8b')
        const baseModelId = modelId.includes(':') ? modelId.split(':').slice(1).join(':') : modelId;
        const costIn = (this.COST_INPUT[baseModelId] ?? this.COST_INPUT[modelId] ?? 0) * inputTokens / 1000;
        const costOut = (this.COST_OUTPUT[baseModelId] ?? this.COST_OUTPUT[modelId] ?? 0) * outputTokens / 1000;
        const estimatedCost = parseFloat((costIn + costOut).toFixed(8));

        await (this.prisma as any).aIUsage.create({
            data: {
                companyId,
                tokens: estimatedTokens,
                cost: estimatedCost,
            }
        });

        // Alerta de custo diário (fire-and-forget)
        this.checkCostAlert(companyId, estimatedCost).catch(() => { });
    }

    async transcribeAudio(mediaUrl: string, companyId?: string) {
        try {
            this.logger.log(`Iniciando transcrição nativa (Whisper) para: ${mediaUrl}`);

            // Resolve API key: prefere chave da empresa no banco, fallback para env var global
            let openAiKey = process.env.OPENAI_API_KEY;
            if (companyId) {
                const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
                const openaiConfig = companyConfigs.get('openai');
                if (openaiConfig?.apiKey) openAiKey = openaiConfig.apiKey;
            }

            if (!openAiKey) {
                this.logger.warn('Aviso: OPENAI_API_KEY não definida. Transcrição indisponível.');
                return "[Serviço de transcrição indisponível]";
            }

            // 1. Baixar o arquivo de áudio
            const audioResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
            const audioBuffer = Buffer.from(audioResponse.data);

            // 2. Preparar payload FormData para a API da OpenAI
            const formData = new FormData();
            formData.append('file', audioBuffer, { filename: 'audio.ogg', contentType: 'audio/ogg' });
            formData.append('model', 'whisper-1');

            // 3. Enviar para transcrição Whisper direto na OpenAI
            const response = await axios.post(
                'https://api.openai.com/v1/audio/transcriptions',
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        Authorization: `Bearer ${openAiKey}`,
                    },
                }
            );

            return response.data.text || null;
        } catch (error) {
            this.logger.error(`Erro na transcrição de áudio com Whisper: ${error.message}`);
            return "[Erro na transcrição automática do áudio]";
        }
    }

    async summarize(companyId: string, agentId: string, messages: any[]) {
        const agent = await this.findOneAgent(companyId, agentId);
        if (!agent || !agent.isActive) return null;

        const conversation = messages.map(m => `${m.fromMe ? 'Atendente' : 'Cliente'}: ${m.content}`).join('\n');
        const modelId = agent.modelId || 'gpt-4o-mini';

        try {
            const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
            const llmConfig = companyConfigs.get(this.detectProviderFromModelId(modelId));
            return await this.llmService.generateResponse(
                modelId,
                'Você é um assistente encarregado de resumir conversas de suporte técnico.',
                `Resuma a seguinte conversa de forma concisa em no máximo 3 frases:\n\n${conversation}`,
                [],
                0.3,
                undefined,
                llmConfig?.apiKey || undefined,
                llmConfig?.baseUrl || undefined,
            );
        } catch (error) {
            this.logger.error(`Erro ao gerar resumo: ${error.message}`);
            return null;
        }
    }

    async analyzeSentiment(companyId: string, agentId: string, content: string) {
        const agent = await this.findOneAgent(companyId, agentId);
        if (!agent || !agent.isActive) return null;

        const prompt = `Analise o sentimento da seguinte conversa e responda APENAS um JSON: {"sentiment": "POSITIVE|NEUTRAL|NEGATIVE", "score": 0.0-10.0, "justification": "breve explicação"}:\n\n"${content}"`;
        const modelId = agent.modelId || 'gpt-4o-mini';

        try {
            const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
            const llmConfig = companyConfigs.get(this.detectProviderFromModelId(modelId));
            const aiResponse = await this.llmService.generateResponse(
                modelId,
                'Você é um analista de sentimentos especialista em CX.',
                prompt,
                [],
                0,
                undefined,
                llmConfig?.apiKey || undefined,
                llmConfig?.baseUrl || undefined,
            );

            const jsonMatch = aiResponse.match(/\{.*\}/s);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return {
                sentiment: 'NEUTRAL',
                score: 5.0,
                justification: aiResponse
            };
        } catch (error) {
            this.logger.error(`Erro na análise sentimental: ${error.message}`);
            return null;
        }
    }

    /**
     * Copilot: gera sugestões de resposta para o atendente baseado no contexto da conversa.
     */
    async copilotSuggest(companyId: string, context: string, agentName: string, contactName: string): Promise<string[]> {
        // Tenta usar o primeiro agente ativo da empresa para herdar as configs de LLM
        const agent = await (this.prisma as any).aIAgent.findFirst({
            where: { companyId, isActive: true },
        });

        const modelId = agent?.modelId || 'gpt-4o-mini';
        const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
        const providerId = modelId.includes(':') ? modelId.split(':')[0] : modelId.split('-')[0];
        const providerConfig = companyConfigs.get(providerId) || companyConfigs.get('openai');
        const apiKey = providerConfig?.apiKey;

        const systemPrompt = `Você é um assistente de atendimento ao cliente. Sua tarefa é sugerir respostas profissionais e empáticas para o atendente "${agentName}" responder ao cliente "${contactName}". Baseie-se no histórico da conversa fornecido. Responda APENAS com um JSON array de 2-3 strings curtas (máx 200 chars cada), sem explicações extras. Exemplo: ["Sugestão 1", "Sugestão 2"]`;

        const userMessage = `Histórico da conversa:\n${context}\n\nGere 2-3 sugestões de resposta para o atendente enviar agora.`;

        try {
            const raw = await this.llmService.generateResponse(modelId, systemPrompt, userMessage, [], 0.7, '', apiKey);
            // Extrai JSON do response
            const match = raw.match(/\[[\s\S]*?\]/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                if (Array.isArray(parsed)) return parsed.slice(0, 3).map(String);
            }
            // Fallback: retorna linhas não vazias
            return raw.split('\n').filter(l => l.trim().length > 5).slice(0, 3);
        } catch (err) {
            this.logger.error(`[Copilot] Erro ao gerar sugestões: ${err.message}`);
            return [];
        }
    }

    /**
     * Retorna o uso acumulado de tokens/IA da empresa.
     */
    async getUsage(companyId: string) {
        const totalTokens = await (this.prisma as any).aIUsage.aggregate({
            where: { companyId },
            _sum: { tokens: true, cost: true },
            _count: true,
        });

        return {
            totalTokens: totalTokens._sum.tokens || 0,
            totalCost: totalTokens._sum.cost || 0,
            totalCalls: totalTokens._count || 0,
        };
    }

    /**
     * Retorna métricas detalhadas de uso da IA com proteção contra lentidão no DB.
     */
    async getDetailedMetrics(companyId: string) {
        try {
            // Métricas gerais
            const usage = await this.getUsage(companyId);

            // Uso por dia (últimos 30 dias) - Tempo limite implícito via Promise.race ou apenas try-catch para evitar crash
            const dailyUsagePromise = (this.prisma as any).$queryRaw`
                SELECT 
                    DATE("createdAt") as date,
                    SUM(tokens) as tokens,
                    COUNT(*) as calls
                FROM "ai_usage"
                WHERE "companyId" = ${companyId}
                AND "createdAt" >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY DATE("createdAt")
                ORDER BY date ASC
            `;

            // Uso por agente
            const agentUsagePromise = (this.prisma as any).$queryRaw`
                SELECT 
                    a.name as "agentName",
                    a."modelId" as model,
                    a."isActive" as active
                FROM "ai_agents" a
                WHERE a."companyId" = ${companyId}
                ORDER BY a.name ASC
            `;

            // Uso por modelo
            const modelUsagePromise = (this.prisma as any).$queryRaw`
                SELECT 
                    a."modelId" as model,
                    COUNT(a.id) as "agentCount"
                FROM "ai_agents" a
                WHERE a."companyId" = ${companyId}
                AND a."modelId" IS NOT NULL
                GROUP BY a."modelId"
                ORDER BY "agentCount" DESC
            `;

            const [dailyUsage, agentUsage, modelUsage] = await Promise.all([
                dailyUsagePromise.catch(() => []),
                agentUsagePromise.catch(() => []),
                modelUsagePromise.catch(() => []),
            ]);

            return {
                usage,
                dailyUsage: Array.isArray(dailyUsage) ? dailyUsage : [],
                agentUsage: Array.isArray(agentUsage) ? agentUsage : [],
                modelUsage: Array.isArray(modelUsage) ? modelUsage : []
            };
        } catch (error) {
            this.logger.error(`Erro ao buscar métricas detalhadas de AI para empresa ${companyId}: ${error.message}`);
            return {
                usage: { totalTokens: 0, totalCost: 0, totalCalls: 0 },
                dailyUsage: [],
                agentUsage: [],
                modelUsage: []
            };
        }
    }

    /**
     * Detecta o providerId a partir do modelId (espelha lógica do LLMProviderFactory.detectProvider).
     */
    private detectProviderFromModelId(modelId: string): string {
        const prefixMap: Record<string, string> = {
            'groq:': 'groq', 'openrouter:': 'openrouter', 'ollama:': 'ollama',
            'azure:': 'azure', 'together:': 'together', 'lmstudio:': 'lmstudio',
            'perplexity:': 'perplexity', 'xai:': 'xai', 'cohere:': 'cohere',
            'huggingface:': 'huggingface', 'deepseek:': 'deepseek',
        };
        for (const [prefix, providerId] of Object.entries(prefixMap)) {
            if (modelId.startsWith(prefix)) return providerId;
        }
        if (modelId.startsWith('claude')) return 'anthropic';
        if (modelId.startsWith('gemini')) return 'gemini';
        if (modelId.startsWith('deepseek')) return 'deepseek';
        if (modelId.startsWith('mistral') || modelId.startsWith('codestral')) return 'mistral';
        return 'openai';
    }

    /**
     * Streaming real de respostas via SSE — emite tokens individuais conforme o LLM os gera.
     * Inclui pipeline completo: cache semântico, RAG, overflow guard e rastreamento de tokens.
     */
    streamChat(companyId: string, agentId: string, message: string, history: any[] = []): Observable<any> {
        if (!message || message.trim().length === 0) throw new BadRequestException('Mensagem não pode ser vazia');
        if (message.length > 4000) message = message.substring(0, 4000);
        history = this.compressContext(history);

        return new Observable<{ data: { type: string; content: string } }>(observer => {
            observer.next({ data: { type: 'start', content: '' } });

            (async () => {
                const agent = await this.findOneAgent(companyId, agentId);
                if (!agent || !agent.isActive) throw new NotFoundException('Agente não encontrado ou inativo');

                await this.checkTokenLimits(companyId);

                // Semantic Cache — em cache hit retorna resposta inteira (não há como "stream" do cache)
                let promptEmbedding: number[] = [];
                try {
                    promptEmbedding = await this.vectorStoreService.generateEmbedding(message, 'qwen');
                    const cacheKeyPrefix = `${companyId}:${agentId}:`;
                    for (const [key, cached] of this.semanticCache.entries()) {
                        if (key.startsWith(cacheKeyPrefix)) {
                            if (Date.now() - cached.timestamp > this.CACHE_TTL_MS) { this.semanticCache.delete(key); continue; }
                            if (this.cosineSimilarity(promptEmbedding, cached.embedding) > 0.95) {
                                this.logger.log(`[Cache HIT/Stream] Similarity > 0.95 para agente ${agent.name}`);
                                observer.next({ data: { type: 'chunk', content: cached.response } });
                                observer.next({ data: { type: 'end', content: '' } });
                                observer.complete();
                                return;
                            }
                        }
                    }
                } catch { /* falha silenciosa: avança sem cache */ }

                const budget = this.allocateTokenBudget(message);
                let finalModelId = agent.modelId || 'gpt-4o-mini';

                // Model routing: downgrade para modelo econômico em queries simples
                if (agent.allowModelDowngrade && budget.chunkLimit === 2 && this.MODEL_DOWNGRADE[finalModelId]) {
                    finalModelId = this.MODEL_DOWNGRADE[finalModelId];
                }

                const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
                const providerId = this.detectProviderFromModelId(finalModelId);
                const llmConfig = companyConfigs.get(providerId);

                if (!llmConfig && providerId !== 'ollama' && providerId !== 'lmstudio') {
                    throw new BadRequestException(`Provider '${providerId}' não configurado.`);
                }

                let context = '';
                if (agent.knowledgeBaseId) {
                    const kb = await (this.prisma as any).knowledgeBase.findUnique({
                        where: { id: agent.knowledgeBaseId },
                        select: { language: true, embeddingProvider: true, embeddingModel: true },
                    });
                    // RAG: usa o embeddingProvider da knowledge base (não do agente),
                    // pois os chunks foram indexados com o provider da KB.
                    const kbEmbeddingProvider = kb?.embeddingProvider || agent.embeddingProvider || 'native';
                    const kbEmbeddingModel = kb?.embeddingModel || agent.embeddingModel || 'all-MiniLM-L6-v2';
                    const kbEmbeddingConfig = companyConfigs.get(kbEmbeddingProvider);

                    this.logger.debug(`[RAG/Stream] Buscando base ${agent.knowledgeBaseId} com provider="${kbEmbeddingProvider}" model="${kbEmbeddingModel}"`);

                    const chunks = await this.vectorStoreService.searchSimilarity(
                        this.prisma, companyId, message, agent.knowledgeBaseId,
                        budget.chunkLimit, kbEmbeddingProvider,
                        kbEmbeddingModel, kbEmbeddingConfig?.apiKey || undefined,
                        kbEmbeddingConfig?.baseUrl || undefined,
                        kb?.language || 'portuguese',
                    );
                    context = chunks.map(c => c.content).join('\n---\n');
                    this.logger.log(`[RAG/Stream] ${chunks.length} chunks retornados para contexto na KB ${agent.knowledgeBaseId}.`);
                }

                context = this.guardContextOverflow(agent.prompt || '', context, history, message, finalModelId);

                const formattedHistory = history.map(h => ({
                    role: (h.role === 'user' || h.role === 'client' ? 'user' : 'assistant') as 'user' | 'assistant',
                    content: h.content,
                }));

                // Streaming real: emite token a token via LangChain .stream()
                let fullResponse = '';
                for await (const token of this.llmService.streamResponse(
                    finalModelId,
                    agent.prompt || 'Você é um assistente virtual prestativo.',
                    message,
                    formattedHistory,
                    agent.temperature || 0.7,
                    context,
                    llmConfig?.apiKey || undefined,
                    llmConfig?.baseUrl || undefined,
                )) {
                    fullResponse += token;
                    observer.next({ data: { type: 'chunk', content: token } });
                }

                // Armazena resposta completa no cache semântico
                if (promptEmbedding.length > 0 && fullResponse) {
                    const cacheKey = `${companyId}:${agentId}:${Date.now()}`;
                    this.semanticCache.set(cacheKey, { embedding: promptEmbedding, response: fullResponse, timestamp: Date.now() });
                    if (this.semanticCache.size > 2000) {
                        const firstKey = this.semanticCache.keys().next().value;
                        if (firstKey) this.semanticCache.delete(firstKey);
                    }
                }

                try {
                    await this.trackTokenUsage(companyId, finalModelId, agent.prompt || '', context, history, fullResponse, 0);
                } catch (e) {
                    this.logger.warn(`Falha ao registrar uso de tokens: ${e.message}`);
                }

                observer.next({ data: { type: 'end', content: '' } });
                observer.complete();
            })().catch(error => {
                this.logger.error(`Erro no streamChat: ${error.message}`);
                observer.next({ data: { type: 'error', content: error.message } });
                observer.complete();
            });
        });
    }
}