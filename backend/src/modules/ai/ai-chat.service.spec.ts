import { Test, TestingModule } from '@nestjs/testing';
import { AIChatService } from './ai-chat.service';
import { PrismaService } from '../../database/prisma.service';
import { LLMService } from './engine/llm.service';
import { VectorStoreService } from './engine/vector-store.service';
import { ProviderConfigService } from '../settings/provider-config.service';
import { AIMetricsService } from './ai-metrics.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('AIChatService', () => {
    let service: AIChatService;

    // Criando mocks dos serviços injetados
    const mockPrisma = {};
    const mockLLMService = {};
    const mockVectorStoreService = {};
    const mockProviderConfigService = {};
    const mockEventEmitter = {};
    const mockMetricsService = {};

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AIChatService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: LLMService, useValue: mockLLMService },
                { provide: VectorStoreService, useValue: mockVectorStoreService },
                { provide: ProviderConfigService, useValue: mockProviderConfigService },
                { provide: EventEmitter2, useValue: mockEventEmitter },
                { provide: AIMetricsService, useValue: mockMetricsService },
            ],
        }).compile();

        service = module.get<AIChatService>(AIChatService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('allocateTokenBudget', () => {
        it('deve retornar chunkLimit = 0 para palavras curtas / fillers', () => {
            const result1 = (service as any).allocateTokenBudget('ok');
            const result2 = (service as any).allocateTokenBudget('obrigada');
            const result3 = (service as any).allocateTokenBudget('sim'); // Filler puro

            expect(result1.chunkLimit).toBe(0);
            expect(result2.chunkLimit).toBe(0);
            expect(result3.chunkLimit).toBe(0);
        });

        it('deve retornar chunkLimit = 15 para mensagens normais (médias)', () => {
            const message = 'Gostaria de saber qual é o preço do serviço básico.';
            const result = (service as any).allocateTokenBudget(message);
            expect(result.chunkLimit).toBe(15);
        });

        it('deve retornar chunkLimit = 20 para mensagens levemente longas (> 100 chars)', () => {
            const message = 'Olá, eu sou um passageiro do voo do ano passado e gostaria de ' +
                'verificar se existe possibilidade de remanejar a rota que eu faria hoje a noite.';
            const result = (service as any).allocateTokenBudget(message);
            expect(result.chunkLimit).toBe(20);
        });

        it('deve retornar chunkLimit = 25 para mensagens textão (análise mais pesada)', () => {
            const message = `Prezados, venho por meio desta relatar um imenso problema que ocorreu comigo 
            na tarde de terça, aonde o serviço prestado foi interrompido sem aviso. Solicito reembolso
            das faturas pois de fato não foi justo. Aguardo o retorno pacientemente. ` + 'A'.repeat(200);
            
            const result = (service as any).allocateTokenBudget(message);
            expect(result.chunkLimit).toBe(25);
        });
    });

    describe('Model Downgrade (Regras Internas)', () => {
        it('deve identificar mappings corretamente ao invocar a dictionary', () => {
            // Testando o mapa estrutural se contém os chaves corretas do plano
            const downgradeMap = (service as any).MODEL_DOWNGRADE;
            
            expect(downgradeMap['gpt-4o']).toBe('gpt-4o-mini');
            expect(downgradeMap['claude-opus-4-6']).toBe('claude-haiku-4-5');
            expect(downgradeMap['gemini-1.5-pro']).toBe('gemini-2.0-flash');
        });
    });
});
