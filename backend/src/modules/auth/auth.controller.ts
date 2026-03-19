import {
    Controller,
    Post,
    Body,
    UseGuards,
    Request,
    Get,
    BadRequestException,
    HttpCode,
    Res,
    Req,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Response } from 'express';
import { AuthenticatedUser } from './interfaces/auth.interfaces';

const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE_BASE = { httpOnly: true, secure: IS_PROD, sameSite: 'lax' as const };
const ACCESS_TOKEN_TTL = 15 * 60 * 1000;        // 15 min
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60 * 1000; // 7 dias

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Public()
    @UseGuards(LocalAuthGuard)
    @Post('login')
    @Throttle({ strict: { limit: 5, ttl: 60000 } }) // 5 tentativas/min por IP — anti-brute-force
    @ApiOperation({ summary: 'Realizar login' })
    @ApiResponse({ status: 200, description: 'Login realizado com sucesso — retorna access_token e refresh_token' })
    @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
    @ApiResponse({ status: 429, description: 'Muitas tentativas. Aguarde 1 minuto.' })
    async login(@Request() req: { user: AuthenticatedUser }, @Body() _loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
        const result = await this.authService.login(req.user);
        // Setar tokens como httpOnly cookies (não acessíveis via JS — proteção XSS)
        res.cookie('access_token', result.access_token, { ...COOKIE_BASE, maxAge: ACCESS_TOKEN_TTL, path: '/' });
        res.cookie('refresh_token', result.refresh_token, { ...COOKIE_BASE, maxAge: REFRESH_TOKEN_TTL, path: '/api/auth' });
        return result; // retorna corpo também para compatibilidade com integrações externas
    }

    @Public()
    @Post('refresh')
    @HttpCode(200)
    @Throttle({ strict: { limit: 10, ttl: 60000 } }) // 10 renovações/min por IP
    @ApiOperation({ summary: 'Renovar access_token usando refresh_token' })
    @ApiResponse({ status: 200, description: 'Novos tokens gerados com sucesso' })
    @ApiResponse({ status: 401, description: 'Refresh token inválido ou expirado' })
    async refresh(
        @Body('refresh_token') bodyToken: string,
        @Req() req: { cookies: Record<string, string>, user?: AuthenticatedUser },
        @Res({ passthrough: true }) res: Response,
    ) {
        const token = bodyToken || req.cookies?.refresh_token;
        if (!token) {
            throw new BadRequestException('refresh_token é obrigatório');
        }
        const result = await this.authService.refreshTokens(token);
        res.cookie('access_token', result.access_token, { ...COOKIE_BASE, maxAge: ACCESS_TOKEN_TTL, path: '/' });
        res.cookie('refresh_token', result.refresh_token, { ...COOKIE_BASE, maxAge: REFRESH_TOKEN_TTL, path: '/api/auth' });
        return result;
    }

    @Public()
    @Post('logout')
    @HttpCode(200)
    @SkipThrottle()
    @ApiOperation({ summary: 'Encerrar sessão (invalida o refresh_token)' })
    @ApiResponse({ status: 200, description: 'Sessão encerrada com sucesso' })
    async logout(
        @Body('refresh_token') bodyToken: string,
        @Req() req: { cookies: Record<string, string>, user?: AuthenticatedUser },
        @Res({ passthrough: true }) res: Response,
    ) {
        const token = bodyToken || req.cookies?.refresh_token;
        if (token) {
            await this.authService.logout(token);
        }
        res.clearCookie('access_token', { path: '/' });
        res.clearCookie('refresh_token', { path: '/api/auth' });
        return { success: true };
    }

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    @SkipThrottle()
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Obter perfil do usuário logado' })
    getProfile(@Request() req: { user: AuthenticatedUser }) {
        // Retorna apenas campos seguros — evita expor permissions[], departments IDs internos
        const { id, email, companyId, role, departments } = req.user;
        return { id, email, companyId, role, departments };
    }
}
