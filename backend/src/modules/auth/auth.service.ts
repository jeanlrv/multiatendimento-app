import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private config: ConfigService,
        private prisma: PrismaService,
    ) { }

    async validateUser(email: string, pass: string): Promise<any> {
        const cleanEmail = email?.trim().toLowerCase();

        if (!cleanEmail || !pass) {
            this.logger.warn('Email ou senha ausentes na requisição');
            return null;
        }

        const user = await this.usersService.findByEmail(cleanEmail);

        if (!user) {
            this.logger.warn(`Usuário não encontrado: ${cleanEmail}`);
            return null;
        }

        const isPasswordValid = await bcrypt.compare(pass, user.password);

        if (isPasswordValid) {
            const { password, ...result } = user;
            return result;
        }

        this.logger.warn(`Senha incorreta para: ${cleanEmail}`);
        return null;
    }

    private async generateTokens(user: any): Promise<{ access_token: string; refresh_token: string; user: object }> {
        // role pode ser objeto Prisma (Role) ou string legada — normalizar para string
        const roleName: string =
            typeof user.role === 'object' && user.role !== null
                ? (user.role.name ?? 'USER')
                : (user.role ?? 'USER');

        // Permissões vêm do banco via role.permissions[]
        const rolePermissions: string[] =
            Array.isArray(user.role?.permissions) ? user.role.permissions : [];

        const departments = user.departments?.map((ud: any) => ({
            id: ud.department?.id ?? ud.id,
            name: ud.department?.name ?? ud.name,
        })) || [];

        const payload = {
            sub: user.id,
            email: user.email,
            companyId: user.companyId,
            role: roleName,
            permissions: rolePermissions,
            departments,
        };

        const expiration = this.config.get<string>('JWT_EXPIRATION', '15m');
        const accessToken = this.jwtService.sign(payload, { expiresIn: expiration });

        // Gerar refresh token seguro e persistir no banco
        const refreshTokenStr = randomBytes(40).toString('hex');
        const refreshExpDays = parseInt(this.config.get<string>('JWT_REFRESH_EXPIRATION_DAYS', '7'), 10);
        const expiresAt = new Date(Date.now() + refreshExpDays * 24 * 60 * 60 * 1000);

        await this.prisma.refreshToken.create({
            data: {
                token: refreshTokenStr,
                userId: user.id,
                expiresAt,
            },
        });

        return {
            access_token: accessToken,
            refresh_token: refreshTokenStr,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar ?? null,
                role: roleName,
                permissions: rolePermissions,
                companyId: user.companyId,
                departments,
            },
        };
    }

    async login(user: any) {
        return this.generateTokens(user);
    }

    async refreshTokens(token: string) {
        const stored = await this.prisma.refreshToken.findUnique({
            where: { token },
            include: {
                user: {
                    include: {
                        role: true,
                        departments: {
                            include: { department: true },
                        },
                    },
                },
            },
        });

        if (!stored) {
            throw new UnauthorizedException('Refresh token inválido ou não encontrado');
        }

        if (stored.expiresAt < new Date()) {
            // Token expirado — limpar e rejeitar
            await this.prisma.refreshToken.delete({ where: { id: stored.id } });
            throw new UnauthorizedException('Refresh token expirado. Faça login novamente.');
        }

        // Rotacionar: deletar o token antigo antes de gerar o novo
        await this.prisma.refreshToken.delete({ where: { id: stored.id } });

        return this.generateTokens(stored.user);
    }

    async logout(token: string): Promise<void> {
        await this.prisma.refreshToken.deleteMany({ where: { token } });
    }

    async logoutAll(userId: string): Promise<void> {
        await this.prisma.refreshToken.deleteMany({ where: { userId } });
    }
}
