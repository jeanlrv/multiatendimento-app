import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcryptjs';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockUser = {
    id: 'user-uuid-1',
    email: 'admin@empresa.com',
    name: 'Admin',
    password: '$2a$10$hashed_password',
    companyId: 'company-abc',
    avatar: null,
    role: { name: 'ADMIN', permissions: ['TICKETS_READ', 'TICKETS_CREATE'] },
    departments: [],
};

const mockUsersService = { findByEmail: jest.fn() };
const mockJwtService = { sign: jest.fn().mockReturnValue('mock_jwt_token') };
const mockConfigService = {
    get: jest.fn((key: string, def?: string) => {
        const config: Record<string, string> = {
            JWT_EXPIRATION: '15m',
            JWT_REFRESH_EXPIRATION_DAYS: '7',
        };
        return config[key] ?? def;
    }),
};
const mockPrismaService = {
    refreshToken: {
        create: jest.fn().mockResolvedValue({ token: 'refresh-token-hex', userId: 'user-uuid-1', expiresAt: new Date() }),
        findUnique: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
};

// ── Suite ──────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
    let service: AuthService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: UsersService, useValue: mockUsersService },
                { provide: JwtService, useValue: mockJwtService },
                { provide: ConfigService, useValue: mockConfigService },
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // ── validateUser ─────────────────────────────────────────────────────────────

    describe('validateUser()', () => {
        it('deve retornar usuário sem campo password quando credenciais válidas', async () => {
            mockUsersService.findByEmail.mockResolvedValueOnce(mockUser);
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

            const result = await service.validateUser('admin@empresa.com', 'Admin@123');

            expect(result).not.toHaveProperty('password');
            expect(result?.id).toBe('user-uuid-1');
            expect(result?.email).toBe('admin@empresa.com');
        });

        it('deve normalizar email para lowercase antes da busca', async () => {
            mockUsersService.findByEmail.mockResolvedValueOnce(null);

            await service.validateUser('ADMIN@EMPRESA.COM', 'Admin@123');

            expect(mockUsersService.findByEmail).toHaveBeenCalledWith('admin@empresa.com');
        });

        it('deve retornar null quando senha incorreta', async () => {
            mockUsersService.findByEmail.mockResolvedValueOnce(mockUser);
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

            const result = await service.validateUser('admin@empresa.com', 'senha-errada');

            expect(result).toBeNull();
        });

        it('deve retornar null quando usuário não encontrado', async () => {
            mockUsersService.findByEmail.mockResolvedValueOnce(null);

            const result = await service.validateUser('naoexiste@empresa.com', 'qualquer');

            expect(result).toBeNull();
        });

        it('deve retornar null quando email ou senha estão ausentes', async () => {
            const result1 = await service.validateUser('', 'senha');
            const result2 = await service.validateUser('email@test.com', '');

            expect(result1).toBeNull();
            expect(result2).toBeNull();
        });
    });

    // ── login ─────────────────────────────────────────────────────────────────────

    describe('login()', () => {
        it('deve gerar access_token e refresh_token', async () => {
            const result = await service.login(mockUser);

            expect(result).toHaveProperty('access_token');
            expect(result).toHaveProperty('refresh_token');
            expect(result).toHaveProperty('user');
            expect(mockJwtService.sign).toHaveBeenCalled();
        });

        it('JWT payload deve incluir companyId para isolamento multi-tenant', async () => {
            await service.login(mockUser);

            const signCall = mockJwtService.sign.mock.calls[0][0];
            expect(signCall).toHaveProperty('companyId', 'company-abc');
            expect(signCall).toHaveProperty('sub', 'user-uuid-1');
        });

        it('JWT payload deve incluir permissions do role', async () => {
            await service.login(mockUser);

            const signCall = mockJwtService.sign.mock.calls[0][0];
            expect(signCall.permissions).toContain('TICKETS_READ');
        });

        it('deve persistir refresh token no banco', async () => {
            await service.login(mockUser);

            expect(mockPrismaService.refreshToken.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ userId: 'user-uuid-1' }),
                }),
            );
        });
    });

    // ── refreshTokens ─────────────────────────────────────────────────────────────

    describe('refreshTokens()', () => {
        it('deve lançar UnauthorizedException para token inválido', async () => {
            mockPrismaService.refreshToken.findUnique.mockResolvedValueOnce(null);

            await expect(service.refreshTokens('token-invalido')).rejects.toThrow(UnauthorizedException);
        });

        it('deve lançar UnauthorizedException para token expirado', async () => {
            mockPrismaService.refreshToken.findUnique.mockResolvedValueOnce({
                token: 'expired-token',
                expiresAt: new Date(Date.now() - 1000), // expirado
                isRevoked: false,
                user: mockUser,
            });

            await expect(service.refreshTokens('expired-token')).rejects.toThrow(UnauthorizedException);
        });
    });
});
