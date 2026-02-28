import { Controller, Get, Put, Delete, Body, Param, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProviderConfigService, ProviderConfigInput } from './provider-config.service';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { Permission } from '../auth/constants/permissions';

@ApiTags('Settings - AI Providers')
@Controller('settings/ai-providers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProviderConfigController {
    constructor(private readonly providerConfigService: ProviderConfigService) { }

    @Get()
    @ApiOperation({ summary: 'Listar configurações de providers de IA da empresa' })
    @RequirePermission(Permission.SETTINGS_READ)
    findAll(@Req() req: any) {
        return this.providerConfigService.findAllForCompany(req.user.companyId);
    }

    @Put(':provider')
    @ApiOperation({ summary: 'Salvar configuração de um provider de IA' })
    @RequirePermission(Permission.SETTINGS_UPDATE)
    upsert(
        @Req() req: any,
        @Param('provider') provider: string,
        @Body() data: ProviderConfigInput,
    ) {
        return this.providerConfigService.upsert(req.user.companyId, provider, data);
    }

    @Delete(':provider')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remover configuração de um provider de IA' })
    @RequirePermission(Permission.SETTINGS_UPDATE)
    async remove(@Req() req: any, @Param('provider') provider: string) {
        await this.providerConfigService.remove(req.user.companyId, provider);
    }
}
