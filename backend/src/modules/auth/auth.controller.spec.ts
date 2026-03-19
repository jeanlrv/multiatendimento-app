import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { Response } from 'express';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthController (Integração)', () => {
    let authController: AuthController;
    let prismaService: PrismaService;

    // Estado inicial simulado do banco de dados (Regra: Estado inicial do banco/sistema)
    const mockDbUser = {
        id: 'user-123',
        email: 'test@kszap.com',
        name: 'Test User',
        password: bcrypt.hashSync('Password@123', 10), // Usando bcrypt real para não mockar implementação interna
        roleId: 'role-123',
        companyId: 'company-123',
        isActive: true,
        role: {
            name: 'ADMIN',
            permissions: ['ALL'],
        },
        departments: [],
    };

    // Chamadas externas que precisamos mockar (Regra: O que chamadas externas você precisa mockar)
    // - PrismaService (Banco de Dados)
    const mockPrisma = {
        user: {
            findUnique: jest.fn().mockImplementation(async ({ where }) => {
                if (where.email === mockDbUser.email.toLowerCase()) return mockDbUser;
                return null;
            }),
        },
        refreshToken: {
            create: jest.fn().mockResolvedValue({ token: 'mock-refresh-token' }),
            findUnique: jest.fn(),
            delete: jest.fn().mockResolvedValue({}),
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
    };

    beforeEach(async () => {
        // Build do módulo de teste (Regra: sem mock de implementação interna como AuthService ou UsersService)
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ isGlobal: true }),
                JwtModule.register({
                    secret: 'test-secret-key-very-long',
                    signOptions: { expiresIn: '15m' },
                }),
            ],
            controllers: [AuthController],
            providers: [
                AuthService,
                UsersService,
                { provide: PrismaService, useValue: mockPrisma },
                // Mock de LockService se necessário
                { provide: 'LockService', useValue: { acquire: jest.fn(), release: jest.fn() } }
            ],
        }).compile();

        authController = module.get<AuthController>(AuthController);
        prismaService = module.get<PrismaService>(PrismaService);
        jest.clearAllMocks();
    });

    // Utilitário para mockar objeto Response do Express de forma robusta
    const mockResponse = () => {
        const res: Partial<Response> = {};
        res.cookie = jest.fn().mockReturnValue(res);
        res.clearCookie = jest.fn().mockReturnValue(res);
        return res as Response;
    };

    describe('POST /auth/login', () => {
        it('deve_retornar_tokens_e_injetar_cookies_http_only_quando_credenciais_sao_validas', async () => {
            // Contexto: Usuário tenta logar com email e senha corretos.
            // Objetivo (O QUE faz): Retornar payload com tokens e setar cookies httpOnly de access e refresh.
            const res = mockResponse();
            const reqUser = {
                id: mockDbUser.id,
                email: mockDbUser.email,
                name: mockDbUser.name,
                companyId: mockDbUser.companyId,
                role: mockDbUser.role.name,
                permissions: mockDbUser.role.permissions,
                departments: mockDbUser.departments,
            };

            const result = await authController.login({ user: reqUser }, { email: 'test@kszap.com', password: 'Password@123' }, res);

            // Validação de Resultado (não como foi feito)
            expect(result).toHaveProperty('access_token');
            expect(result).toHaveProperty('refresh_token');
            expect((result.user as any).email).toBe('test@kszap.com');

            // Validação de Cookies de Segurança
            expect(res.cookie).toHaveBeenCalledWith('access_token', result.access_token, expect.objectContaining({ httpOnly: true }));
            expect(res.cookie).toHaveBeenCalledWith('refresh_token', result.refresh_token, expect.objectContaining({ httpOnly: true }));
        });
    });

    describe('POST /auth/refresh', () => {
        it('deve_renovar_tokens_quando_refresh_token_valido_fornecido_no_cookie', async () => {
            // Contexto: Usuário tenta renovar sessão e o refresh token está presente apenas no cookie.
            // Estado inicial: Token existe válido no banco de dados.
            const validToken = 'valid-refresh-token';
            jest.spyOn(prismaService.refreshToken, 'findUnique').mockResolvedValueOnce({
                id: '1',
                token: validToken,
                userId: mockDbUser.id,
                user: mockDbUser,
                expiresAt: new Date(Date.now() + 86400000), // expira no futuro
                createdAt: new Date(),
            } as any);

            const res = mockResponse();
            const req = { cookies: { refresh_token: validToken }, user: undefined };

            const result = await authController.refresh('', req, res);

            // Validação
            expect(result).toHaveProperty('access_token');
            expect(result).toHaveProperty('refresh_token');
            
            // Verifica se os novos cookies foram setados sobrescrevendo os antigos
            expect(res.cookie).toHaveBeenCalledWith('access_token', result.access_token, expect.objectContaining({ maxAge: 900000 }));
            expect(res.cookie).toHaveBeenCalledWith('refresh_token', result.refresh_token, expect.objectContaining({ httpOnly: true }));
        });

        it('deve_retornar_erro_quando_refresh_token_expirado_ou_invalido', async () => {
            // Contexto: Token submetido não existe no banco (foi revogado ou expirou e foi limpo)
            jest.spyOn(prismaService.refreshToken, 'findUnique').mockResolvedValueOnce(null);

            const res = mockResponse();
            const req = { cookies: { refresh_token: 'invalid-token' } };

            await expect(authController.refresh('', req, res)).rejects.toThrow(UnauthorizedException);
            
            // Nenhuma injeção de cookie deve ocorrer em falhas
            expect(res.cookie).not.toHaveBeenCalled();
        });
    });

    describe('POST /auth/logout', () => {
        it('deve_limpar_cookies_e_invalidar_sessao_no_banco_durante_logout', async () => {
            // Contexto: Usuário desloga passando seu token de refresh via cookie.
            // O sistema deve não apenas limpar os cookies locais, mas remover o token no backend.
            const activeToken = 'active-refresh-token';
            const res = mockResponse();
            const req = { cookies: { refresh_token: activeToken } };

            const result = await authController.logout('', req, res);

            // O retorno é `{ success: true }`
            expect(result).toEqual({ success: true });

            // Deleção de tokens do banco garantindo invalidação global
            expect(prismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
                where: { token: activeToken }
            });

            // Limpeza imperativa de cookies no Response
            expect(res.clearCookie).toHaveBeenCalledWith('access_token', expect.any(Object));
            expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', expect.any(Object));
        });
    });
});
