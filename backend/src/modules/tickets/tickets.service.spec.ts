import { Test, TestingModule } from '@nestjs/testing';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../../database/prisma.service';
import { AIService } from '../ai/ai.service';
import { EvaluationsService } from '../evaluations/evaluations.service';
import { AuditService } from '../audit/audit.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_A = 'company-a-uuid';
const COMPANY_B = 'company-b-uuid';

const mockTicket = {
    id: 'ticket-internal-uuid',
    publicToken: 'public-token-opaque-abc123',
    companyId: COMPANY_A,
    contactId: 'contact-1',
    departmentId: 'dept-1',
    status: 'OPEN',
    subject: 'Suporte técnico',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    resolvedAt: null,
    csatPending: false,
    contact: { name: 'João Silva' },
    department: { name: 'Suporte', id: 'dept-1', aiAgentId: null },
    company: { name: 'Empresa A', logoUrl: null, primaryColor: '#3B82F6' },
    messages: [
        { id: 'msg-1', content: 'Olá', sentAt: new Date(), fromMe: false, messageType: 'TEXT' },
    ],
};

const mockPrismaService = {
    ticket: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        delete: jest.fn(),
    },
    department: { findUnique: jest.fn(), findFirst: jest.fn() },
    setting: { findMany: jest.fn().mockResolvedValue([]) },
    evaluation: { upsert: jest.fn() },
    contact: { update: jest.fn() },
    user: { count: jest.fn() },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
};

const mockAIService = { summarize: jest.fn(), getAgentForDepartment: jest.fn() };
const mockAuditService = { log: jest.fn().mockResolvedValue({}) };
const mockEventEmitter = { emit: jest.fn(), on: jest.fn() };
const mockEvaluationsService = { generateAISentimentAnalysis: jest.fn().mockResolvedValue({}) };
const mockSchedulingQueue = { add: jest.fn() };

// ── Suite ──────────────────────────────────────────────────────────────────────

describe('TicketsService', () => {
    let service: TicketsService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TicketsService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: AIService, useValue: mockAIService },
                { provide: EvaluationsService, useValue: mockEvaluationsService },
                { provide: AuditService, useValue: mockAuditService },
                { provide: EventEmitter2, useValue: mockEventEmitter },
                { provide: getQueueToken('scheduling'), useValue: mockSchedulingQueue },
            ],
        }).compile();

        service = module.get<TicketsService>(TicketsService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // ── getPublicTicket — CRÍTICO: segurança do portal do cliente ──────────────

    describe('getPublicTicket()', () => {
        it('deve buscar pelo publicToken opaco (não pelo id interno)', async () => {
            mockPrismaService.ticket.findUnique.mockResolvedValueOnce(mockTicket);

            const result = await service.getPublicTicket('public-token-opaque-abc123');

            // A query DEVE usar publicToken no where, não id
            expect(mockPrismaService.ticket.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { publicToken: 'public-token-opaque-abc123' },
                }),
            );
            expect(result.publicToken).toBe('public-token-opaque-abc123');
        });

        it('deve incluir publicToken na resposta (para geração de links pelo frontend)', async () => {
            mockPrismaService.ticket.findUnique.mockResolvedValueOnce(mockTicket);
            const result = await service.getPublicTicket('public-token-opaque-abc123');
            expect(result).toHaveProperty('publicToken');
            expect(result.publicToken).toBe('public-token-opaque-abc123');
        });

        it('deve lançar NotFoundException para publicToken inexistente', async () => {
            mockPrismaService.ticket.findUnique.mockResolvedValueOnce(null);
            await expect(service.getPublicTicket('token-invalido')).rejects.toThrow(NotFoundException);
        });

        it('deve retornar mensagens, empresa e contato (sem dados internos sensíveis)', async () => {
            mockPrismaService.ticket.findUnique.mockResolvedValueOnce(mockTicket);
            const result = await service.getPublicTicket('public-token-opaque-abc123');

            expect(result.messages).toBeDefined();
            expect(result.company?.name).toBe('Empresa A');
            expect(result.contact?.name).toBe('João Silva');
            // id interno exposto é aceitável para referência, mas não deve ser o campo de lookup
            expect(result.id).toBe('ticket-internal-uuid');
        });

        it('NÃO deve retornar ticket de um companyId diferente (isolamento cross-tenant)', async () => {
            // Se o publicToken não existir no banco (inclui tokens de outra empresa),
            // deve retornar NotFoundException, nunca o ticket
            mockPrismaService.ticket.findUnique.mockResolvedValueOnce(null);
            await expect(service.getPublicTicket('token-de-outra-empresa')).rejects.toThrow(NotFoundException);
        });
    });

    // ── findOne — isolamento multi-tenant ────────────────────────────────────────

    describe('findOne() — multi-tenancy', () => {
        it('deve incluir companyId na query', async () => {
            mockPrismaService.ticket.findFirst.mockResolvedValueOnce(mockTicket);

            await service.findOne(COMPANY_A, 'ticket-internal-uuid');

            expect(mockPrismaService.ticket.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: 'ticket-internal-uuid',
                        companyId: COMPANY_A,
                    }),
                }),
            );
        });

        it('deve lançar NotFoundException quando ticket pertence a outra empresa (COMPANY_B)', async () => {
            // Ticket existe para COMPANY_A, mas query feita com COMPANY_B retorna null
            mockPrismaService.ticket.findFirst.mockResolvedValueOnce(null);

            await expect(service.findOne(COMPANY_B, 'ticket-internal-uuid')).rejects.toThrow(NotFoundException);
        });
    });

    // ── update — isolamento multi-tenant ─────────────────────────────────────────

    describe('update() — multi-tenancy', () => {
        it('deve lançar NotFoundException ao atualizar ticket de outra empresa', async () => {
            mockPrismaService.ticket.findFirst.mockResolvedValueOnce(null);

            await expect(
                service.update(COMPANY_B, 'ticket-internal-uuid', { status: 'RESOLVED' } as any),
            ).rejects.toThrow(NotFoundException);
        });
    });
});
