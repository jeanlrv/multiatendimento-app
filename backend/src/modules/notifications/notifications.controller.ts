import { Controller, Get, Post, Delete, Patch, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    @Get()
    @ApiOperation({ summary: 'Notificações não lidas do usuário autenticado' })
    async getUnread(@Req() req: any) {
        return this.notificationsService.findUnread(req.user.id || req.user.sub, req.user.companyId);
    }

    @Get('count')
    @ApiOperation({ summary: 'Contagem de notificações não lidas' })
    async getCount(@Req() req: any) {
        const count = await this.notificationsService.getUnreadCount(req.user.id || req.user.sub, req.user.companyId);
        return { count };
    }

    @Patch('read')
    @HttpCode(200)
    @ApiOperation({ summary: 'Marcar notificações específicas como lidas' })
    async markRead(@Req() req: any, @Body() body: { ids: string[] }) {
        await this.notificationsService.markAsRead(req.user.id || req.user.sub, body.ids ?? []);
        return { success: true };
    }

    @Patch('read-all')
    @HttpCode(200)
    @ApiOperation({ summary: 'Marcar todas as notificações como lidas' })
    async markAllRead(@Req() req: any) {
        await this.notificationsService.markAllRead(req.user.id || req.user.sub, req.user.companyId);
        return { success: true };
    }

    // ─── Web Push ─────────────────────────────────────────────────────────────

    @Public()
    @Get('vapid-public-key')
    @ApiOperation({ summary: 'Retorna a VAPID public key para inscrição de Web Push' })
    getVapidPublicKey() {
        return { publicKey: process.env.VAPID_PUBLIC_KEY ?? null };
    }

    @Post('subscribe')
    @HttpCode(201)
    @ApiOperation({ summary: 'Salva subscription de Web Push do browser do agente' })
    async subscribe(@Req() req: any, @Body() body: { endpoint: string; keys: { p256dh: string; auth: string } }) {
        const userId = req.user.id || req.user.sub;
        await this.notificationsService.saveSubscription(userId, body);
        return { success: true };
    }

    @Delete('subscribe')
    @HttpCode(200)
    @ApiOperation({ summary: 'Remove subscription de Web Push' })
    async unsubscribe(@Body() body: { endpoint: string }) {
        await this.notificationsService.deleteSubscription(body.endpoint);
        return { success: true };
    }
}
