import { Test, TestingModule } from '@nestjs/testing';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../../database/prisma.service';
import { AIService } from '../ai/ai.service';
import { EvaluationsService } from '../evaluations/evaluations.service';
import { AuditService } from '../audit/audit.service';
import { TicketStatus, TicketPriority } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('TicketsService', () => {
    let service: TicketsService;
    let prisma: PrismaService;
    let aiService: AIService;

    const mockPrismaService = {
        ticket: {
            create: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
        },
        department: {
            findUnique: jest.fn(),
        },
    };

    const mockAiService = {
        summarize: jest.fn(),
    };

    const mockEvaluationsService = {
        generateAISentimentAnalysis: jest.fn().mockResolvedValue({}),
    };

    const mockAuditService = {
        log: jest.fn().mockResolvedValue({}),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TicketsService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: AIService, useValue: mockAiService },
                { provide: EvaluationsService, useValue: mockEvaluationsService },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<TicketsService>(TicketsService);
        prisma = module.get<PrismaService>(PrismaService);
        aiService = module.get<AIService>(AIService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('findOne', () => {
        it('should return a ticket if found', async () => {
            const ticket = { id: '1', subject: 'Test' };
            mockPrismaService.ticket.findUnique.mockResolvedValue(ticket);

            const result = await service.findOne('1', 'comp1');
            expect(result).toEqual(ticket);
        });

        it('should throw NotFoundException if ticket not found', async () => {
            mockPrismaService.ticket.findUnique.mockResolvedValue(null);
            await expect(service.findOne('1', 'comp1')).rejects.toThrow(NotFoundException);
        });
    });

    describe('create', () => {
        it('should create a ticket without auto-distribution', async () => {
            const createDto = { contactId: 'c1', subject: 'Test', departmentId: 'd1' };
            mockPrismaService.department.findUnique.mockResolvedValue({ id: 'd1', autoDistribute: false });
            mockPrismaService.ticket.create.mockResolvedValue({ id: 't1', ...createDto });

            const result = await service.create('comp1', createDto as any);
            expect(result.id).toBe('t1');
            expect(prisma.ticket.create).toHaveBeenCalled();
        });
    });

    describe('resolve', () => {
        it('should resolve ticket and generate AI summary if needed', async () => {
            const ticket = {
                id: '1',
                department: { aiAgentId: 'ai1' },
                messages: [{ content: 'hello' }],
                assignedUserId: 'u1'
            };
            mockPrismaService.ticket.findUnique.mockResolvedValue(ticket);
            mockAiService.summarize.mockResolvedValue('Summary');
            mockPrismaService.ticket.update.mockResolvedValue({ ...ticket, status: TicketStatus.RESOLVED });

            const result = await service.resolve('1', 'comp1');

            expect(result.status).toBe(TicketStatus.RESOLVED);
            expect(aiService.summarize).toHaveBeenCalled();
            expect(mockAuditService.log).toHaveBeenCalled();
        });
    });
});
