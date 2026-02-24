import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAIAgentDto } from './dto/create-ai-agent.dto';
import { UpdateAIAgentDto } from './dto/update-ai-agent.dto';
import axios from 'axios';

@Injectable()
export class AIService {
    private readonly logger = new Logger(AIService.name);
    private readonly apiUrl = process.env.ANYTHINGLLM_BASE_URL;
    private readonly apiKey = process.env.ANYTHINGLLM_API_KEY;

    constructor(private prisma: PrismaService) { }

    // AIAgent CRUD
    async createAgent(companyId: string, data: CreateAIAgentDto) {
        return this.prisma.aIAgent.create({
            data: {
                ...data,
                companyId
            }
        });
    }

    async findAllAgents(companyId: string) {
        return this.prisma.aIAgent.findMany({
            where: { companyId }
        });
    }

    async findOneAgent(companyId: string, id: string) {
        return this.prisma.aIAgent.findFirst({
            where: { id, companyId }
        });
    }

    async updateAgent(companyId: string, id: string, data: UpdateAIAgentDto) {
        return this.prisma.aIAgent.updateMany({
            where: { id, companyId },
            data
        });
    }

    async removeAgent(companyId: string, id: string) {
        return this.prisma.aIAgent.deleteMany({
            where: { id, companyId }
        });
    }

    // AnythingLLM Integration
    async chat(companyId: string, agentId: string, message: string, history: { role: string, content: string }[] = []) {
        const agent = await this.findOneAgent(companyId, agentId);
        if (!agent || !agent.isActive) {
            throw new Error('Agente não encontrado ou inativo');
        }

        try {
            const contextPrompt = history.length > 0
                ? `Histórico da conversa:\n${history.map(h => `${h.role}: ${h.content}`).join('\n')}\n\nCliente: ${message}`
                : message;

            const response = await axios.post(
                `${this.apiUrl}/api/v1/workspace/${agent.anythingllmWorkspaceId}/chat`,
                {
                    message: contextPrompt,
                    mode: 'chat',
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return response.data.textResponse;
        } catch (error) {
            this.logger.error(`Erro ao chamar AnythingLLM: ${error.message}`);
            throw error;
        }
    }

    async transcribeAudio(mediaUrl: string) {
        try {
            this.logger.log(`Iniciando transcrição real via AnythingLLM para: ${mediaUrl}`);

            const audioResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
            const audioBuffer = Buffer.from(audioResponse.data);

            const formData = new (require('form-data'))();
            formData.append('file', audioBuffer, { filename: 'audio.ogg', contentType: 'audio/ogg' });

            const response = await axios.post(
                `${this.apiUrl}/api/v1/system/transcribe-audio`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                }
            );

            return response.data.text || null;
        } catch (error) {
            this.logger.error(`Erro na transcrição AnythingLLM: ${error.message}`);
            return "[Erro na transcrição automática]";
        }
    }

    async summarize(companyId: string, agentId: string, messages: any[]) {
        const agent = await this.findOneAgent(companyId, agentId);
        if (!agent || !agent.isActive) return null;

        const conversation = messages.map(m => `${m.fromMe ? 'Atendente' : 'Cliente'}: ${m.content}`).join('\n');
        const prompt = `Resuma a seguinte conversa de atendimento de forma concisa em no máximo 3 frases:\n\n${conversation}`;

        try {
            const response = await axios.post(
                `${this.apiUrl}/api/v1/workspace/${agent.anythingllmWorkspaceId}/chat`,
                {
                    message: prompt,
                    mode: 'chat',
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return response.data.textResponse;
        } catch (error) {
            this.logger.error(`Erro ao gerar resumo: ${error.message}`);
            return null;
        }
    }

    async analyzeSentiment(companyId: string, agentId: string, content: string) {
        const agent = await this.findOneAgent(companyId, agentId);
        if (!agent || !agent.isActive) return null;

        const prompt = `Analise o sentimento da seguinte conversa de atendimento e responda APENAS um JSON no formato {"sentiment": "POSITIVE|NEUTRAL|NEGATIVE", "score": 0.0-10.0, "justification": "breve explicação"}:\n\n"${content}"`;

        try {
            const response = await axios.post(
                `${this.apiUrl}/api/v1/workspace/${agent.anythingllmWorkspaceId}/chat`,
                {
                    message: prompt,
                    mode: 'chat',
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const aiResponse = response.data.textResponse;
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
}

