import {
    Controller,
    Post,
    Body,
    UseGuards,
    Request,
    Get,
    BadRequestException,
    HttpCode,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';

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
    async login(@Request() req, @Body() _loginDto: LoginDto) {
        return this.authService.login(req.user);
    }

    @Public()
    @Post('refresh')
    @HttpCode(200)
    @Throttle({ strict: { limit: 10, ttl: 60000 } }) // 10 renovações/min por IP
    @ApiOperation({ summary: 'Renovar access_token usando refresh_token' })
    @ApiResponse({ status: 200, description: 'Novos tokens gerados com sucesso' })
    @ApiResponse({ status: 401, description: 'Refresh token inválido ou expirado' })
    async refresh(@Body('refresh_token') token: string) {
        if (!token) {
            throw new BadRequestException('refresh_token é obrigatório');
        }
        return this.authService.refreshTokens(token);
    }

    @Public()
    @Post('logout')
    @HttpCode(200)
    @SkipThrottle()
    @ApiOperation({ summary: 'Encerrar sessão (invalida o refresh_token)' })
    @ApiResponse({ status: 200, description: 'Sessão encerrada com sucesso' })
    async logout(@Body('refresh_token') token: string) {
        if (token) {
            await this.authService.logout(token);
        }
        return { success: true };
    }

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    @SkipThrottle()
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Obter perfil do usuário logado' })
    getProfile(@Request() req) {
        return req.user;
    }
}
