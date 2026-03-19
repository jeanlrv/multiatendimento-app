import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { createPrismaMock } from '../../database/prisma-mock';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Socket } from 'socket.io';

describe('ChatGateway', () => {
    let gateway: ChatGateway;
    let jwtService: jest.Mocked<JwtService>;
    let prisma: jest.Mocked<PrismaService>;
    let eventEmitter: jest.Mocked<EventEmitter2>;

    beforeEach(async () => {
        jwtService = { verify: jest.fn() } as any;
        prisma = createPrismaMock() as any;
        eventEmitter = { emit: jest.fn() } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatGateway,
                { provide: JwtService, useValue: jwtService },
                { provide: PrismaService, useValue: prisma },
                { provide: EventEmitter2, useValue: eventEmitter },
            ],
        }).compile();

        gateway = module.get<ChatGateway>(ChatGateway);
        gateway.server = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn(),
            sockets: { sockets: new Map() }
        } as any;
    });

    afterEach(() => {
        gateway.onModuleDestroy();
        jest.clearAllMocks();
    });

    // ── extractTokenFromCookie ──────────────────────────────────────────────────

    it('extractTokenFromCookie deve extrair token de cookie string', () => {
        const token = gateway['extractTokenFromCookie']('foo=bar; access_token=my-secret-token; baz=qux');
        expect(token).toBe('my-secret-token');
    });

    it('extractTokenFromCookie deve retornar null se não houver cookie', () => {
        expect(gateway['extractTokenFromCookie'](undefined)).toBeNull();
        expect(gateway['extractTokenFromCookie']('foo=bar')).toBeNull();
    });

    // ── handleConnection ────────────────────────────────────────────────────────

    it('handleConnection deve desconectar client sem token', async () => {
        const client = {
            id: 'client-1',
            handshake: { auth: {}, headers: {} },
            disconnect: jest.fn(),
        } as unknown as Socket;

        await gateway.handleConnection(client);

        expect(client.disconnect).toHaveBeenCalled();
        expect(jwtService.verify).not.toHaveBeenCalled();
    });

    it('handleConnection deve popular client.data.user com JWT válido e join salas', async () => {
        const mockPayload = { sub: 'user-1', companyId: 'comp-1' };
        jwtService.verify.mockReturnValue(mockPayload);

        const client = {
            id: 'client-2',
            handshake: { auth: { token: 'valid-token' }, headers: {} },
            data: {},
            join: jest.fn(),
            emit: jest.fn(),
        } as unknown as Socket;

        await gateway.handleConnection(client);

        expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
        expect(client.data.user).toEqual(mockPayload);
        expect(client.join).toHaveBeenCalledWith('user:user-1');
        expect(client.join).toHaveBeenCalledWith('company:comp-1');
    });

    // ── handleJoinTicket ────────────────────────────────────────────────────────

    it('handleJoinTicket deve rejeitar acesso a ticket de outra empresa', async () => {
        const client = {
            data: { user: { companyId: 'comp-1' } },
            join: jest.fn(),
            emit: jest.fn(),
        } as unknown as Socket;

        // Simulando ticket NÃO encontrado (pertence à outra empresa ou dep restrito)
        (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

        const result = await gateway.handleJoinTicket(client, 'ticket-1');

        expect(result).toBeUndefined(); // O retorno é undefined pois disparou emit('error') e retornou
        expect(client.emit).toHaveBeenCalledWith('error', 'Acesso negado ao ticket ou departamento');
        expect(client.join).not.toHaveBeenCalled();
    });

    it('handleJoinTicket deve permitir acesso a ticket da mesma empresa', async () => {
        const client = {
            data: { user: { companyId: 'comp-1' } },
            join: jest.fn(),
        } as unknown as Socket;

        // Simulando ticket pertencente à mesma empresa e sem dep restrito
        (prisma.ticket.findFirst as jest.Mock).mockResolvedValue({ id: 'ticket-1', companyId: 'comp-1', departmentId: null });

        const result = await gateway.handleJoinTicket(client, 'ticket-1');

        expect(result).toEqual({ event: 'joined', data: 'ticket-1' });
        expect(client.join).toHaveBeenCalledWith('ticket:ticket-1');
    });

    // ── emitNewMessage ────────────────────────────────────────────────────────

    it('emitNewMessage deve emitir para sala do ticket E sala da empresa', () => {
        const mockMessage = { id: 'msg-1', content: 'hello' };
        
        gateway.emitNewMessage('comp-1', 'ticket-1', mockMessage);

        expect(gateway.server.to).toHaveBeenCalledWith('ticket:ticket-1');
        expect(gateway.server.to).toHaveBeenCalledWith('company:comp-1');
        
        // Verifica as duas emissões: uma para sala do ticket e outra global empresa
        const lastToCall = (gateway.server.to as jest.Mock).mock.results;
        expect(gateway.server.to).toHaveBeenCalledTimes(2);
        
        // Verificação simplificada por evento
        const emitCalls = (gateway.server.emit as jest.Mock).mock.calls;
        expect(emitCalls).toContainEqual(['newMessage', mockMessage]);
        expect(emitCalls).toContainEqual(['globalMessage', { ticketId: 'ticket-1', message: mockMessage }]);
    });

    // ── isRateLimited ────────────────────────────────────────────────────────

    it('isRateLimited deve bloquear eventos com intervalo < 2s', () => {
        // Primeira chamada deve passar
        expect(gateway['isRateLimited']('client-1', 'typing')).toBe(false);
        
        // Chamada imediata deve ser bloqueada
        expect(gateway['isRateLimited']('client-1', 'typing')).toBe(true);

        // Chamada de outro evento não é bloqueada
        expect(gateway['isRateLimited']('client-1', 'other')).toBe(false);
    });

    // ── revalidateConnectedClients ──────────────────────────────────────────────

    it('revalidateConnectedClients deve desconectar client com JWT expirado', () => {
        const client1 = {
            id: 'c1',
            handshake: { auth: { token: 'valid' } },
            emit: jest.fn(),
            disconnect: jest.fn(),
        };
        const client2 = {
            id: 'c2',
            handshake: { auth: { token: 'expired' } },
            emit: jest.fn(),
            disconnect: jest.fn(),
        };

        const socketsMap = new Map();
        socketsMap.set('c1', client1);
        socketsMap.set('c2', client2);
        
        // Simulando os sockets do gateway
        Object.defineProperty(gateway.server, 'sockets', {
            value: { sockets: socketsMap }
        });

        // Configurar mock do verify: falha para token "expired"
        jwtService.verify.mockImplementation((token: string) => {
            if (token === 'expired') throw new Error('jwt expired');
            return { sub: 'valid-user' };
        });

        gateway['revalidateConnectedClients']();

        // c1 se mantém conectado
        expect(client1.disconnect).not.toHaveBeenCalled();

        // c2 é desconectado
        expect(client2.emit).toHaveBeenCalledWith('error', 'Sessão expirada. Reconecte-se.');
        expect(client2.disconnect).toHaveBeenCalled();
    });
});
