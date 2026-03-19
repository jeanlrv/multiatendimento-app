import { Test, TestingModule } from '@nestjs/testing';
import { AIChatService } from './ai-chat.service';
import { PrismaService } from '../../database/prisma.service';
import { LLMService } from './engine/llm.service';
import { VectorStoreService } from './engine/vector-store.service';
import { ProviderConfigService } from '../settings/provider-config.service';
import { AIMetricsService } from './ai-metrics.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('AI Chat Engine (Integração Média Mocks)', () => {
    let service: AIChatService;
    let mockLlmService: any;
    let mockVectorStoreService: any;

    beforeEach(async () => {
        // Serviços chave com espiões que simulam falhas
        mockLlmService = {
            generateResponse: jest.fn(),
        };

        mockVectorStoreService = {
            invalidateRagCache: jest.fn(),
            searchSimilarity: jest.fn().mockResolvedValue([
                { content: 'Regra de devolução: 7 dias corridos.', score: 0.98, metadata: { source: 'faq.pdf' } }
            ]),
            generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
            cosineSimilarity: jest.fn()
        };

        const mockPrisma = {
            aIAgent: { findFirst: jest.fn().mockResolvedValue({ id: 'agent-1', companyId: 'comp-1', isActive: true, modelId: 'gpt-4o' }) },
            knowledgeBase: { findUnique: jest.fn().mockResolvedValue(null) },
            conversation: { findFirst: jest.fn().mockResolvedValue(null) },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AIChatService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: LLMService, useValue: mockLlmService },
                { provide: VectorStoreService, useValue: mockVectorStoreService },
                { provide: ProviderConfigService, useValue: { getDecryptedForCompany: jest.fn().mockResolvedValue(new Map()) } },
                { provide: EventEmitter2, useValue: { emit: jest.fn() } },
                { provide: AIMetricsService, useValue: { checkTokenLimits: jest.fn(), trackTokenUsage: jest.fn().mockResolvedValue(true) } },
            ],
        }).compile();

        service = module.get<AIChatService>(AIChatService);

        // Resetar estatísticas do Circuit Breaker global se necessário
        (service as any).llmCircuitBreaker.state = 'CLOSED';
        (service as any).llmCircuitBreaker.failureCount = 0;
        (service as any).llmCircuitBreaker.nextAttempt = 0;
    });

    it('deve formatar e compilar o RAG System Prompt de forma segura', () => {
        // Este teste foca na FASE 2 da montagem: buildRagSystemPrompt 
        const base = 'Você é um assistente.';
        const contextLines = '[Fonte 1: docs.txt | relevância: 98%]\nProduto x custa $10\n---\n[Fonte 2: docs.txt]\nNão tem juros.';
        
        const output = (service as any).buildRagSystemPrompt(base, contextLines);
        
        // Verifica se ele envelopou o conteúdo em headers defensivos
        expect(output.systemPrompt).toContain('VERDADE OFICIAL');
        expect(output.systemPrompt).toContain('Produto x custa $10');
        expect(output.context).toBe(''); // No final ele esvazia o raw context para poupar RAM
    });

    it('deve abrir o Circuit Breaker de LLM caso o Provider caia ou der timeout 3 vezes seguidas', async () => {
        // Simulando que o LLM tá lançando erro de Axios (timeout/connetion refused)
        mockLlmService.generateResponse.mockRejectedValue(new Error('LLM Timeout API'));
        
        const callChat = () => service.chat('comp-1', 'agent-1', 'Test message', []);

        // Tentativa 1 (Falha Original)
        await expect(callChat()).rejects.toThrow(/LLM Timeout API/i);
        
        // Tentativa 2 (Falha Original)
        await expect(callChat()).rejects.toThrow(/LLM Timeout API/i);

        // Tentativa 3 (Falha Original)
        await expect(callChat()).rejects.toThrow(/LLM Timeout API/i);

        // Tentativa 4 (Desarme Rápido por Circuit Breaker - STATE OPEN)
        // O throw de um state Open é manipulado pelo próprio breaker "Service Unavailable"
        // Sem esperar o timeout da promessa
        await expect(callChat()).rejects.toThrow(/Circuit Breaker/i);
    });
});
