import { Test, TestingModule } from '@nestjs/testing';
import { WebhookProcessingService } from './webhook-processing.service';
import { PrismaService } from '../../database/prisma.service';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { CryptoService } from '../../common/services/crypto.service';
import { LockService } from '../workflows/core/lock.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessageType } from '@prisma/client';
import { ZApiWebhookPayload } from './dto/zapi-webhook.dto';

describe('WebhookProcessingService', () => {
    let service: WebhookProcessingService;

    // Criando mocks dos serviços injetados
    const mockPrisma = {};
    const mockChatService = {};
    const mockChatGateway = {};
    const mockCryptoService = {};
    const mockEventEmitter = {};
    const mockLockService = {};

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WebhookProcessingService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: ChatService, useValue: mockChatService },
                { provide: ChatGateway, useValue: mockChatGateway },
                { provide: CryptoService, useValue: mockCryptoService },
                { provide: EventEmitter2, useValue: mockEventEmitter },
                { provide: LockService, useValue: mockLockService },
            ],
        }).compile();

        service = module.get<WebhookProcessingService>(WebhookProcessingService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('extractMessageContent', () => {
        it('deve extrair texto simples de text.message', () => {
            const payload: ZApiWebhookPayload = {
                instanceId: '123',
                messageId: 'msg1',
                phone: '123456',
                text: { message: 'Olá mundo' },
            };
            const result = service.extractMessageContent(payload);
            expect(result.messageType).toBe(MessageType.TEXT);
            expect(result.content).toBe('Olá mundo');
        });

        it('deve extrair imagem com legenda (caption)', () => {
            const payload: ZApiWebhookPayload = {
                instanceId: '123',
                messageId: 'msg2',
                phone: '123456',
                image: {
                    imageUrl: 'https://exemplo.com/imagem.png',
                    caption: 'Olha essa imagem',
                },
            };
            const result = service.extractMessageContent(payload);
            expect(result.messageType).toBe(MessageType.IMAGE);
            expect(result.mediaUrl).toBe('https://exemplo.com/imagem.png');
            expect(result.content).toBe('Olha essa imagem');
        });

        it('deve extrair arquivo de áudio', () => {
            const payload: ZApiWebhookPayload = {
                instanceId: '123',
                messageId: 'msg3',
                phone: '123456',
                audio: {
                    audioUrl: 'https://exemplo.com/audio.ogg',
                },
            };
            const result = service.extractMessageContent(payload);
            expect(result.messageType).toBe(MessageType.AUDIO);
            expect(result.mediaUrl).toBe('https://exemplo.com/audio.ogg');
            expect(result.content).toBe('[Áudio]');
        });

        it('deve lidar com botões de resposta interativos (buttonResponse)', () => {
            const payload: ZApiWebhookPayload = {
                instanceId: '123',
                messageId: 'msg4',
                phone: '123456',
                buttonResponse: {
                    selectedButtonLabel: 'Sim, eu aceito',
                },
            };
            const result = service.extractMessageContent(payload);
            expect(result.messageType).toBe(MessageType.TEXT);
            expect(result.content).toBe('Sim, eu aceito');
        });

        it('deve criar um fallback seguro quando o payload vier com formato inesperado', () => {
            const payload: ZApiWebhookPayload = {
                instanceId: '123',
                messageId: 'msg5',
                phone: '123456',
                body: 'Fallback message string direta',
            };
            const result = service.extractMessageContent(payload);
            expect(result.messageType).toBe(MessageType.TEXT);
            expect(result.content).toBe('Fallback message string direta');
        });
    });

    // Teste de Business Hours requer fazer bypass de acesso private.
    describe('checkBusinessHours', () => {
        let originalDate: any;

        beforeAll(() => {
            originalDate = Date;
        });

        afterAll(() => {
            global.Date = originalDate;
        });

        it('deve retornar null (dentro do horario) para configuracao valida', () => {
            // Travamos a data global para uma Terça-Feira às 14:00 de Brasilia (-03:00).
            // Em UTC isso é Terça 17:00.
            const fixedDate = new Date('2023-10-24T17:00:00Z');
            jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as unknown as Date);

            const departmentConfig = {
                name: 'Vendas',
                timezone: 'America/Sao_Paulo',
                outOfHoursMessage: 'Estamos fechados',
                businessHours: {
                    '2': { start: '08:00', end: '18:00' } // Terça (0=Dom, 1=Seg, 2=Ter)
                }
            };

            // O método é privado, usamos coerção
            const isOutOfHoursMsg = (service as any).checkBusinessHours(departmentConfig);
            expect(isOutOfHoursMsg).toBeNull();
        });

        it('deve retornar a outOfHoursMessage caso esteja fora do horario (ex: 19:00)', () => {
            // Terça, 19:00 Brasilia (22:00 UTC)
            const fixedDate = new Date('2023-10-24T22:00:00Z');
            jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as unknown as Date);

            const departmentConfig = {
                name: 'Suporte',
                timezone: 'America/Sao_Paulo',
                outOfHoursMessage: 'Tente amanha',
                businessHours: {
                    'tuesday': { start: '09:00', end: '18:00' } // Funciona usando nome na key tb?
                }
            };

            const isOutOfHoursMsg = (service as any).checkBusinessHours(departmentConfig);
            expect(isOutOfHoursMsg).toBe('Tente amanha');
        });
    });
});
