import { Controller, Get, Patch, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
}
