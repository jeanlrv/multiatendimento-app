import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('ai/api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
    constructor(private readonly apiKeysService: ApiKeysService) { }

    @Post()
    async create(
        @Req() req: any,
        @Body() body: { name: string, agentId?: string }
    ) {
        const companyId = req.user.companyId;
        return this.apiKeysService.createKey(companyId, body.name, body.agentId);
    }

    @Get()
    async list(@Req() req: any) {
        const companyId = req.user.companyId;
        return this.apiKeysService.listKeys(companyId);
    }

    @Delete(':id')
    async revoke(
        @Req() req: any,
        @Param('id') id: string
    ) {
        const companyId = req.user.companyId;
        return this.apiKeysService.revokeKey(companyId, id);
    }
}
