import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../../database/prisma.service';
import { ChatGateway } from './chat.gateway';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { AIService } from '../ai/ai.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessageType } from '@prisma/client';

describe('ChatService', () => {
    let service: ChatService;
    let prisma: jest.Mocked<PrismaService>;
    let chatGateway: jest.Mocked<ChatGateway>;
    let whatsappService: jest.Mocked<WhatsAppService>;
    let aiService: jest.Mocked<AIService>;
    let eventEmitter: jest.Mocked<EventEmitter2>;

    beforeEach(async () => {
        const prismaMock = {
            $transaction: jest.fn((callback) => callback(prismaMock)),
            message: {
                create: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
                findMany: jest.fn(),
                findFirst: jest.fn(),
            },
            ticket: {
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                update: jest.fn(),
            },
            department: {
                findMany: jest.fn(),
                findUnique: jest.fn(),
                findFirst: jest.fn(),
            },
        };

        const gatewayMock = {
            emitNewMessage: jest.fn(),
            emitMessageStatusUpdate: jest.fn(),
            emitMention: jest.fn(),
        };

        const whatsappMock = {
            sendMessage: jest.fn(),
            sendImage: jest.fn(),
            sendPttAudio: jest.fn(),
        };

        const aiMock = {
            chat: jest.fn(),
            transcribeAudio: jest.fn(),
            describeImage: jest.fn(),
        };

        const emitterMock = {
            emit: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatService,
                { provide: PrismaService, useValue: prismaMock },
                { provide: ChatGateway, useValue: gatewayMock },
                { provide: WhatsAppService, useValue: whatsappMock },
                { provide: AIService, useValue: aiMock },
                { provide: EventEmitter2, useValue: emitterMock },
            ],
        }).compile();

        service = module.get<ChatService>(ChatService);
        prisma = module.get(PrismaService);
        chatGateway = module.get(ChatGateway);
        whatsappService = module.get(WhatsAppService);
        aiService = module.get(AIService);
        eventEmitter = module.get(EventEmitter2);

        // Spy interno para evitar chain calls que dependem do prisma
        jest.spyOn(service as any, 'handleAIResponse').mockResolvedValue(undefined);
        jest.spyOn(service as any, 'handleIncomingClientMessage').mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ── sendMessage ────────────────────────────────────────────────────────

    it('sendMessage deve criar mensagem no banco e emitir via gateway', async () => {
        const mockTicket = { id: 'ticket-1', companyId: 'comp-1', contact: { phoneNumber: '123' } };
        const mockMessage = { id: 'msg-1', content: 'ola', ticketId: 'ticket-1' };

        (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
        (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket);

        await service.sendMessage('ticket-1', 'ola', true, MessageType.TEXT, undefined, 'comp-1', 'AGENT');

        expect(prisma.message.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                ticketId: 'ticket-1',
                content: 'ola',
                fromMe: true,
                origin: 'AGENT',
            })
        });

        expect(chatGateway.emitNewMessage).toHaveBeenCalledWith('comp-1', 'ticket-1', mockMessage);
    });

    it('sendMessage deve enviar via WhatsApp quando fromMe=true', async () => {
        const mockTicket = { id: 'ticket-1', companyId: 'comp-1', connectionId: 'conn-1', contact: { phoneNumber: '551199999999' } };
        const mockMessage = { id: 'msg-1', content: 'ola do agente', ticketId: 'ticket-1', fromMe: true, messageType: 'TEXT' };

        (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
        (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket);
        whatsappService.sendMessage.mockResolvedValue({ id: 'zapi-123' });

        await service.sendMessage('ticket-1', 'ola do agente', true, MessageType.TEXT, undefined, 'comp-1', 'AGENT');

        // Aguarda promises internas (microtasks) pois event emitters/whatsapp enviam de forma assíncrona depois do return
        await new Promise(process.nextTick); 

        expect(whatsappService.sendMessage).toHaveBeenCalledWith('conn-1', '551199999999', 'ola do agente', 'comp-1');
        expect(prisma.message.update).toHaveBeenCalledWith({
            where: { id: 'msg-1' },
            data: { status: 'SENT', externalId: 'zapi-123' }
        });
    });

    it('sendMessage deve atualizar lastMessageAt do ticket e incrementar unreadMessages se do cliente', async () => {
        const mockTicket = { id: 'ticket-1', companyId: 'comp-1', contact: { phoneNumber: '123' } };
        const mockMessage = { id: 'msg-1', content: 'cliente falando', ticketId: 'ticket-1', fromMe: false };

        (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
        (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket);

        await service.sendMessage('ticket-1', 'cliente falando', false, MessageType.TEXT, undefined, 'comp-1', 'CLIENT');

        expect(prisma.ticket.update).toHaveBeenCalledWith({
            where: { id: 'ticket-1' },
            data: expect.objectContaining({
                lastMessageAt: expect.any(Date),
                unreadMessages: { increment: 1 }
            })
        });

        // Deve chamar o processador de IA quando a mensagem é do cliente
        expect(service['handleIncomingClientMessage']).toHaveBeenCalledWith(mockTicket, 'cliente falando', 'TEXT', undefined, 'msg-1');
    });

    it('sendMessage deve rejeitar operação sem companyId (isolamento tenant)', async () => {
        await expect(
            service.sendMessage('ticket-1', 'ola', true, MessageType.TEXT, undefined, undefined, 'AGENT')
        ).rejects.toThrow('companyId ausente');
    });
});
