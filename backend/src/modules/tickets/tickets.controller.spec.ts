import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { Permission } from '../auth/constants/permissions';

describe('TicketsController', () => {
    let controller: TicketsController;
    let service: jest.Mocked<TicketsService>;

    beforeEach(async () => {
        const mockService = {
            create: jest.fn(),
            findAll: jest.fn(),
            exportCsv: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            resolve: jest.fn(),
            bulkAction: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [TicketsController],
            providers: [{ provide: TicketsService, useValue: mockService }],
        }).compile();

        controller = module.get<TicketsController>(TicketsController);
        service = module.get(TicketsService);
    });

    // ── findAll ────────────────────────────────────────────────────────────────

    it('findAll deve passar companyId do JWT e params do request para o service', async () => {
        const req = {
            user: { companyId: 'comp-1', permissions: [Permission.TICKETS_READ_ALL] }
        };

        service.findAll.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } });

        await controller.findAll(req, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, '2', '50');

        expect(service.findAll).toHaveBeenCalledWith('comp-1', expect.objectContaining({
            page: 2,
            limit: 50
        }));
    });

    it('findAll deve retornar array vazio se user não tem permissão global nem deptos permitidos', async () => {
        const req = {
            user: { companyId: 'comp-1', permissions: [], departments: [] } // Sem permissões, sem deptos
        };

        const result = await controller.findAll(req);

        expect(result).toEqual([]);
        expect(service.findAll).not.toHaveBeenCalled();
    });

    // ── findOne ────────────────────────────────────────────────────────────────

    it('findOne deve chamar service com companyId e ticket id', async () => {
        const req = { user: { companyId: 'comp-1' } };
        service.findOne.mockResolvedValue({ id: 'ticket-1' } as any);

        await controller.findOne(req, 'ticket-1');

        expect(service.findOne).toHaveBeenCalledWith('comp-1', 'ticket-1');
    });

    // ── create ──────────────────────────────────────────────────────────────────

    it('create deve chamar service.create com companyId correto e DTO', async () => {
        const req = { user: { companyId: 'comp-1' } };
        const dto: CreateTicketDto = { contactId: 'contact-1', departmentId: 'dept-1', connectionId: 'conn-1' };

        await controller.create(req, dto);

        expect(service.create).toHaveBeenCalledWith('comp-1', dto);
    });

    // ── update ──────────────────────────────────────────────────────────────────

    it('update deve chamar service.update com companyId, ticket id e userId do agente', async () => {
        const req = { user: { companyId: 'comp-1', id: 'agent-1' } };
        const dto: UpdateTicketDto = { status: 'OPEN' };

        await controller.update(req, 'ticket-1', dto);

        expect(service.update).toHaveBeenCalledWith('comp-1', 'ticket-1', dto, 'agent-1');
    });

    // ── resolve ─────────────────────────────────────────────────────────────────

    it('resolve deve retornar ticket resolvido', async () => {
        const req = { user: { companyId: 'comp-1', id: 'agent-1' } };
        
        await controller.resolve(req, 'ticket-1');

        expect(service.resolve).toHaveBeenCalledWith('comp-1', 'ticket-1', 'agent-1');
    });

    // ── bulkAction ──────────────────────────────────────────────────────────────

    it('bulkAction deve passar companyId para o service', async () => {
        const req = { user: { companyId: 'comp-1' } };
        const dto = { action: 'RESOLVE' as any, ids: ['t1', 't2'] };
        
        await controller.bulkAction(req, dto);

        expect(service.bulkAction).toHaveBeenCalledWith('comp-1', dto);
    });

    // ── exportCsv ───────────────────────────────────────────────────────────────

    it('exportCsv deve formatar a resposta como CSV UTF-8 e enviar BOM', async () => {
        const req = {
            user: { companyId: 'comp-1', permissions: [Permission.TICKETS_READ_ALL] }
        };
        const res = {
            setHeader: jest.fn(),
            send: jest.fn(),
        } as any;

        const csvContent = 'id,status\n1,OPEN';
        service.exportCsv.mockResolvedValue(csvContent);

        await controller.exportCsv(req, res);

        expect(service.exportCsv).toHaveBeenCalledWith('comp-1', expect.any(Object));
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
        expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment; filename="tickets_'));
        
        // Deve inserir o prefixo BOM (Byte Order Mark) para UTF-8 (\uFEFF)
        expect(res.send).toHaveBeenCalledWith('\uFEFF' + csvContent);
    });
});
