import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CannedResponsesService } from './canned-responses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { Permission } from '../auth/constants/permissions';

@ApiTags('Canned Responses')
@Controller('canned-responses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CannedResponsesController {
    constructor(private readonly service: CannedResponsesService) { }

    @Get()
    @RequirePermission(Permission.TICKETS_READ)
    @ApiOperation({ summary: 'Listar macros / respostas rápidas' })
    findAll(@Req() req: any, @Query('q') search?: string) {
        return this.service.findAll(req.user.companyId, search);
    }

    @Post()
    @RequirePermission(Permission.SETTINGS_UPDATE)
    @ApiOperation({ summary: 'Criar nova macro' })
    create(@Req() req: any, @Body() body: { title: string; content: string }) {
        return this.service.create(req.user.companyId, body);
    }

    @Patch(':id')
    @RequirePermission(Permission.SETTINGS_UPDATE)
    @ApiOperation({ summary: 'Atualizar macro' })
    update(@Req() req: any, @Param('id') id: string, @Body() body: { title?: string; content?: string }) {
        return this.service.update(req.user.companyId, id, body);
    }

    @Delete(':id')
    @RequirePermission(Permission.SETTINGS_UPDATE)
    @HttpCode(200)
    @ApiOperation({ summary: 'Remover macro' })
    remove(@Req() req: any, @Param('id') id: string) {
        return this.service.remove(req.user.companyId, id);
    }
}
