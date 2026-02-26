import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAIAgentDto } from './dto/create-ai-agent.dto';
import { UpdateAIAgentDto } from './dto/update-ai-agent.dto';
import { LLMService } from './engine/llm.service';
import { VectorStoreService } from './engine/vector-store.service';
import { Observable, from } from 'rxjs';

@Injectable()
export class AIService {
    private readonly logger = new Logger(AIService.name);

    constructor(
        private prisma: PrismaService,
        private llmService: LLMService,
        private vectorStoreService: VectorStoreService,
    ) { }

    // AIAgent CRUD
    async createAgent(companyId: string, data: CreateAIAgentDto) {
        return (this.prisma as any).aIAgent.create({
            data: {
                ...data,
                companyId
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
        if (!agent) throw new Error('Agente não encontrado');

        return (this.prisma as any).aIAgent.update({
            where: { id },
            data
        });
    }

    async removeAgent(companyId: string, id: string) {
        return (this.prisma as any).aIAgent.deleteMany({
            where: { id, companyId }
        });
    }

    /**
     * Motor de Chat Nativo: Usa LangChain com suporte multi-provider.
     */
    async chat(companyId: string, agentId: string, message: string, history: any[] = []) {
        // 1. Validação de entrada
        if (!message || message.trim().length === 0) {
            throw new Error('Mensagem não pode ser vazia');
        }

        // Limitar tamanho da mensagem (4000 caracteres)
        if (message.length > 4000) {
            message = message.substring(0, 4000);
        }

        // Limitar histórico a 20 mensagens
        if (history.length > 20) {
            history = history.slice(-20);
        }

        const agent = await this.findOneAgent(companyId, agentId);
        if (!agent || !agent.isActive) {
            throw new Error('Agente não encontrado ou inativo');
        }

        // 2. Verificação de Limite de Tokens (Rate Limiting)
        const company = await (this.prisma as any).company.findUnique({
            where: { id: companyId },
            select: { limitTokens: true, limitTokensPerHour: true, limitTokensPerDay: true }
        });

        // Verificar limites por hora e por dia
        const now = new Date();
        const startOfHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

        const hourlyUsage = await (this.prisma as any).aIUsage.aggregate({
            where: {
                companyId,
                createdAt: {
                    gte: startOfHour
                }
            },
            _sum: { tokens: true }
        });

        const dailyUsage = await (this.prisma as any).aIUsage.aggregate({
            where: {
                companyId,
                createdAt: {
                    gte: startOfDay
                }
            },
            _sum: { tokens: true }
        });

        const totalTokens = await (this.prisma as any).aIUsage.aggregate({
            where: { companyId },
            _sum: { tokens: true }
        });

        const hourlyTokens = hourlyUsage._sum.tokens || 0;
        const dailyTokens = dailyUsage._sum.tokens || 0;
        const totalTokensUsed = totalTokens._sum.tokens || 0;

        // Verificar limites
        if (company && company.limitTokensPerHour > 0 && hourlyTokens >= company.limitTokensPerHour) {
            throw new ForbiddenException(`Limite de tokens por hora atingido (${company.limitTokensPerHour}). Tente novamente mais tarde.`);
        }

        if (company && company.limitTokensPerDay > 0 && dailyTokens >= company.limitTokensPerDay) {
            throw new ForbiddenException(`Limite de tokens por dia atingido (${company.limitTokensPerDay}). Tente novamente amanhã.`);
        }

        if (company && company.limitTokens > 0 && totalTokensUsed >= company.limitTokens) {
            throw new ForbiddenException(`Limite total de tokens de IA atingido (${company.limitTokens}). Entre em contato com o suporte.`);
        }

        try {
            this.logger.log(`Chat com agente "${agent.name}" usando modelo: ${agent.modelId || 'gpt-4o-mini'}`);

            let context = '';
            // Se o agente tiver uma base de conhecimento vinculada, buscamos contexto (RAG)
            if (agent.knowledgeBaseId) {
                const chunks = await this.vectorStoreService.searchSimilarity(
                    companyId,
                    message,
                    agent.knowledgeBaseId
                );
                context = chunks.map(c => c.content).join('\n---\n');
            }

            const response = await this.llmService.generateResponse(
                agent.modelId || 'gpt-4o-mini',
                agent.prompt || 'Você é um assistente virtual prestativo.',
                message,
                history.map(h => ({
                    role: h.role === 'user' || h.role === 'client' ? 'user' : 'assistant',
                    content: h.content
                })),
                agent.temperature || 0.7,
                context
            );

            // Registrar uso de tokens (se disponível)
            try {
                await this.trackTokenUsage(companyId, response);
            } catch (e) {
                this.logger.warn(`Falha ao registrar uso de tokens: ${e.message}`);
            }

            return response;
        } catch (error) {
            this.logger.error(`Erro no chat: ${error.message}`);
            throw error;
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
        // 1. Validação de entrada
        if (!message || message.trim().length === 0) {
            throw new Error('Mensagem não pode ser vazia');
        }

        // Limitar tamanho da mensagem (4000 caracteres)
        if (message.length > 4000) {
            message = message.substring(0, 4000);
        }

        // Limitar histórico a 20 mensagens
        if (history.length > 20) {
            history = history.slice(-20);
        }

        // Limitar imagens a 5 por requisição
        if (imageUrls.length > 5) {
            throw new Error('Máximo de 5 imagens por requisição');
        }

        const agent = await this.findOneAgent(companyId, agentId);
        if (!agent || !agent.isActive) {
            throw new Error('Agente não encontrado ou inativo');
        }

        // 2. Verificação de Limite de Tokens (Rate Limiting)
        const company = await (this.prisma as any).company.findUnique({
            where: { id: companyId },
            select: { limitTokens: true, limitTokensPerHour: true, limitTokensPerDay: true }
        });

        // Verificar limites por hora e por dia
        const now = new Date();
        const startOfHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

        const hourlyUsage = await (this.prisma as any).aIUsage.aggregate({
            where: {
                companyId,
                createdAt: {
                    gte: startOfHour
                }
            },
            _sum: { tokens: true }
        });

        const dailyUsage = await (this.prisma as any).aIUsage.aggregate({
            where: {
                companyId,
                createdAt: {
                    gte: startOfDay
                }
            },
            _sum: { tokens: true }
        });

        const totalTokens = await (this.prisma as any).aIUsage.aggregate({
            where: { companyId },
            _sum: { tokens: true }
        });

        const hourlyTokens = hourlyUsage._sum.tokens || 0;
        const dailyTokens = dailyUsage._sum.tokens || 0;
        const totalTokensUsed = totalTokens._sum.tokens || 0;

        // Verificar limites
        if (company && company.limitTokensPerHour > 0 && hourlyTokens >= company.limitTokensPerHour) {
            throw new ForbiddenException(`Limite de tokens por hora atingido (${company.limitTokensPerHour}). Tente novamente mais tarde.`);
        }

        if (company && company.limitTokensPerDay > 0 && dailyTokens >= company.limitTokensPerDay) {
            throw new ForbiddenException(`Limite de tokens por dia atingido (${company.limitTokensPerDay}). Tente novamente amanhã.`);
        }

        if (company && company.limitTokens > 0 && totalTokensUsed >= company.limitTokens) {
            throw new ForbiddenException(`Limite total de tokens de IA atingido (${company.limitTokens}). Entre em contato com o suporte.`);
        }

        try {
            this.logger.log(`Chat multimodal com agente "${agent.name}" usando modelo: ${agent.modelId || 'gpt-4o-mini'}`);

            const response = await this.llmService.generateMultimodalResponse(
                agent.modelId || 'gpt-4o-mini',
                agent.prompt || 'Você é um assistente virtual prestativo.',
                message,
                imageUrls,
                history.map(h => ({
                    role: h.role === 'user' || h.role === 'client' ? 'user' : 'assistant',
                    content: h.content
                })),
                agent.temperature || 0.7
            );

            // Registrar uso de tokens (estimativa maior para multimodal)
            try {
                await this.trackTokenUsage(companyId, response, imageUrls.length);
            } catch (e) {
                this.logger.warn(`Falha ao registrar uso de tokens: ${e.message}`);
            }

            return response;
        } catch (error) {
            this.logger.error(`Erro no chat multimodal: ${error.message}`);
            throw error;
        }
    }

    /**
     * Registra uso de tokens na tabela AIUsage
     */
    private async trackTokenUsage(companyId: string, response: string, imageCount: number = 0) {
        // Estimativa simples de tokens: ~4 chars por token
        // Multimodal usa mais tokens (imagens)
        const estimatedTokens = Math.ceil(response.length / 4) + (imageCount * 100);
        await (this.prisma as any).aIUsage.create({
            data: {
                companyId,
                tokens: estimatedTokens,
                cost: 0, // Custo real pode ser calculado futuramente baseado no provider
            }
        });
    }

    async transcribeAudio(mediaUrl: string) {
        try {
            this.logger.log(`Iniciando transcrição nativa (Whisper) para: ${mediaUrl}`);

            // 1. Baixar o arquivo de áudio
            const axios = require('axios');
            const audioResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
            const audioBuffer = Buffer.from(audioResponse.data);

            // 2. Preparar payload FormData para a API da OpenAI
            const FormData = require('form-data');
            const formData = new FormData();

            formData.append('file', audioBuffer, { filename: 'audio.ogg', contentType: 'audio/ogg' });
            formData.append('model', 'whisper-1');

            const openAiKey = process.env.OPENAI_API_KEY;
            if (!openAiKey) {
                this.logger.warn('Aviso: OPENAI_API_KEY não definida no ambiente. Transcrição falhará.');
                return "[Serviço de transcrição indisponível]";
            }

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

        try {
            return await this.llmService.generateResponse(
                'gpt-4o-mini',
                'Você é um assistente encarregado de resumir conversas de suporte técnico.',
                `Resuma a seguinte conversa de forma concisa em no máximo 3 frases:\n\n${conversation}`,
                [],
                0.3
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

        try {
            const aiResponse = await this.llmService.generateResponse(
                'gpt-4o-mini',
                'Você é um analista de sentimentos especialista em CX.',
                prompt,
                [],
                0
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
     * Retorna métricas detalhadas de uso da IA
     */
    async getDetailedMetrics(companyId: string) {
        // Métricas gerais
        const usage = await this.getUsage(companyId);

        // Uso por dia (últimos 30 dias)
        const dailyUsage = await (this.prisma as any).$queryRaw`
            SELECT 
                DATE("createdAt") as date,
                SUM(tokens) as tokens,
                COUNT(*) as calls
            FROM "AIUsage"
            WHERE "companyId" = ${companyId}
            AND "createdAt" >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE("createdAt")
            ORDER BY date ASC
        `;

        // Uso por agente
        const agentUsage = await (this.prisma as any).$queryRaw`
            SELECT 
                a.name as agentName,
                COUNT(u.id) as calls,
                SUM(u.tokens) as tokens
            FROM "AIUsage" u
            JOIN "AIAgent" a ON a."companyId" = u."companyId"
            WHERE u."companyId" = ${companyId}
            GROUP BY a.name
            ORDER BY tokens DESC
        `;

        // Uso por modelo
        const modelUsage = await (this.prisma as any).$queryRaw`
            SELECT 
                a."modelId" as model,
                COUNT(u.id) as calls,
                SUM(u.tokens) as tokens
            FROM "AIUsage" u
            JOIN "AIAgent" a ON a."companyId" = u."companyId"
            WHERE u."companyId" = ${companyId}
            AND a."modelId" IS NOT NULL
            GROUP BY a."modelId"
            ORDER BY tokens DESC
        `;

        return {
            usage,
            dailyUsage,
            agentUsage,
            modelUsage
        };
    }

    /**
     * Streaming de respostas da IA usando Server-Sent Events (SSE)
     */
    streamChat(companyId: string, agentId: string, message: string, history: any[] = []): Observable<any> {
        // 1. Validação de entrada
        if (!message || message.trim().length === 0) {
            throw new Error('Mensagem não pode ser vazia');
        }

        // Limitar tamanho da mensagem (4000 caracteres)
        if (message.length > 4000) {
            message = message.substring(0, 4000);
        }

        // Limitar histórico a 20 mensagens
        if (history.length > 20) {
            history = history.slice(-20);
        }

        // Retornar um Observable que irá emitir os chunks da resposta
        return new Observable(observer => {
            // Esta é uma implementação simplificada
            // Na prática, você precisaria de uma implementação mais complexa
            // que interaja com o LLM para obter os chunks em tempo real
            observer.next({ data: { type: 'start', content: '' } });

            // Simular envio de chunks
            const chunks = message.split(' ');
            let index = 0;

            const sendChunk = () => {
                if (index < chunks.length) {
                    observer.next({ data: { type: 'chunk', content: chunks[index] + ' ' } });
                    index++;
                    setTimeout(sendChunk, 100); // Simular delay
                } else {
                    observer.next({ data: { type: 'end', content: '' } });
                    observer.complete();
                }
            };

            sendChunk();
        });
    }
}