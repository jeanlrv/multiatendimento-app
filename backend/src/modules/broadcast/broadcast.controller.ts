import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { BroadcastService } from './broadcast.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { Permission } from '../auth/constants/permissions';

@ApiTags('Broadcast')
@Controller('broadcast')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BroadcastController {
    constructor(private readonly broadcastService: BroadcastService) { }

    @Get()
    @RequirePermission(Permission.TICKETS_READ)
    @ApiOperation({ summary: 'Listar campanhas de broadcast' })
    findAll(@Req() req: any) {
        return this.broadcastService.findAll(req.user.companyId);
    }

    @Post()
    @RequirePermission(Permission.TICKETS_CREATE)
    @ApiOperation({ summary: 'Criar nova campanha de broadcast' })
    create(@Req() req: any, @Body() body: { name: string; message: string; connectionId?: string; contactIds: string[] }) {
        return this.broadcastService.create(req.user.companyId, body);
    }

    @Get(':id')
    @RequirePermission(Permission.TICKETS_READ)
    @ApiOperation({ summary: 'Obter detalhes de uma campanha' })
    findOne(@Req() req: any, @Param('id') id: string) {
        return this.broadcastService.findOne(req.user.companyId, id);
    }

    @Get(':id/status')
    @RequirePermission(Permission.TICKETS_READ)
    @ApiOperation({ summary: 'Status em tempo real da campanha' })
    getStatus(@Req() req: any, @Param('id') id: string) {
        return this.broadcastService.getStatus(req.user.companyId, id);
    }

    @Post(':id/start')
    @RequirePermission(Permission.TICKETS_CREATE)
    @ApiOperation({ summary: 'Iniciar envio da campanha' })
    start(@Req() req: any, @Param('id') id: string) {
        return this.broadcastService.start(req.user.companyId, id);
    }

    @Post(':id/pause')
    @RequirePermission(Permission.TICKETS_UPDATE)
    @ApiOperation({ summary: 'Pausar envio da campanha' })
    pause(@Req() req: any, @Param('id') id: string) {
        return this.broadcastService.pause(req.user.companyId, id);
    }

    @Delete(':id')
    @RequirePermission(Permission.TICKETS_DELETE)
    @ApiOperation({ summary: 'Excluir campanha' })
    remove(@Req() req: any, @Param('id') id: string) {
        return this.broadcastService.remove(req.user.companyId, id);
    }
}
