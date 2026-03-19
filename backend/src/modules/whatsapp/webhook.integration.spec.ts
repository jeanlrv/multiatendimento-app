import { Test, TestingModule } from '@nestjs/testing';
import { WebhookProcessingService } from './webhook-processing.service';
import { PrismaService } from '../../database/prisma.service';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { CryptoService } from '../../common/services/crypto.service';
import { LockService } from '../workflows/core/lock.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('Webhook Race Conditions (Integração Média)', () => {
    let service: WebhookProcessingService;
    let prismaCreateSpy: jest.Mock;

    beforeEach(async () => {
        // Mock simulado com latência no banco de dados
        prismaCreateSpy = jest.fn().mockImplementation(async () => {
            await new Promise(res => setTimeout(res, 50)); // Simula I/O demorado
            return { id: 'contact-1', phone: '551199999999' };
        });

        const mockPrisma = {
            contact: {
                findFirst: jest.fn().mockResolvedValue(null), // Sempre diz que contato não existe
                create: prismaCreateSpy,
                update: jest.fn()
            },
            ticket: {
                findFirst: jest.fn().mockResolvedValue({ id: 'ticket-1' }),
            },
            message: {
                create: jest.fn(),
            },
            company: {
                findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }),
            },
            whatsAppInstance: {
                findFirst: jest.fn().mockResolvedValue({ id: 'inst-1', companyId: 'company-1', isConnected: true }),
                findUnique: jest.fn().mockResolvedValue({ id: 'inst-1', companyId: 'company-1', isConnected: true }),
            }
        };

        // Instância Memory-Based para o LockService
        const mockLockService = {
            locks: new Map<string, boolean>(),
            acquire: jest.fn().mockImplementation(async (key: string, ttl: number) => {
                if (mockLockService.locks.has(key)) return false;
                mockLockService.locks.set(key, true);
                setTimeout(() => mockLockService.locks.delete(key), ttl);
                return true;
            }),
            release: jest.fn().mockImplementation(async (key: string) => {
                mockLockService.locks.delete(key);
            }),
            acquireWithRetry: async function(key: string, ttl: number, retries = 5, delay = 50) {
                for(let i=0; i<retries; i++){
                    if(await this.acquire(key, ttl)) return true;
                    await new Promise(r => setTimeout(r, delay));
                }
                return false;
            }
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WebhookProcessingService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: ChatService, useValue: { sendSystemMessage: jest.fn() } },
                { provide: ChatGateway, useValue: { emitNewMessage: jest.fn(), emitTicketUpdate: jest.fn() } },
                { provide: CryptoService, useValue: { hashApiKey: jest.fn() } },
                { provide: EventEmitter2, useValue: { emit: jest.fn(), emitAsync: jest.fn() } },
                { provide: LockService, useValue: mockLockService },
            ],
        }).compile();

        service = module.get<WebhookProcessingService>(WebhookProcessingService);

        // Simulando a resolução de Company que usa cache em disco pra passar direto:
        jest.spyOn(service as any, 'resolveCompanyId').mockResolvedValue('company-1');
    });

    it('deve simular disparo concorrente de Z-API e garantir proteção contra duplicação de contato', async () => {
        const payload = {
            instanceId: 'valid-inst-1',
            messageId: 'MSG-0001',
            phone: '551199999999',
            fromMe: false,
            text: { message: 'Olá, preciso de suporte duplo clique' }
        };

        // Dispara 5 requisições simulando concorrência (ex: webhook enviado em rajada)
        const racePromises = Array.from({ length: 5 }).map(() =>
            service.processIncomingMessage(payload as any)
        );

        // Aguardamos todas resolverem (algumas falharão por lock e darão reject ou ignore loggado)
        try {
            await Promise.allSettled(racePromises);
        } catch (e) {
            // Silence
        }

        // Aferimos que a criação de contato (que demora 50ms) TENTOU SER CHAMADA APENAS UMA VEZ
        // devido aos spinlocks
        expect(prismaCreateSpy).toHaveBeenCalledTimes(1);
    });
});
