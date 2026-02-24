import { Controller, Get, Patch, Put, Body, UseGuards } from '@nestjs/common';
import { Company } from '../../common/decorators/company.decorator';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UpsertSmtpDto } from './dto/upsert-smtp.dto';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) { }

    @Get('smtp')
    @ApiOperation({ summary: 'Obter configuração SMTP' })
    async getSmtp(@Company() companyId: string) {
        return this.settingsService.getSmtpConfig(companyId);
    }

    @Patch('smtp')
    @ApiOperation({ summary: 'Criar ou atualizar configuração SMTP' })
    async updateSmtp(@Company() companyId: string, @Body() data: UpsertSmtpDto) {
        return this.settingsService.updateSmtpConfig(companyId, data);
    }

    @Get()
    @ApiOperation({ summary: 'Obter todos os parâmetros do sistema' })
    async getSettings(@Company() companyId: string) {
        return this.settingsService.getGeneralSettings(companyId);
    }

    @Put()
    @ApiOperation({ summary: 'Atualizar parâmetros do sistema em lote' })
    async updateSettings(@Company() companyId: string, @Body() data: Record<string, any>) {
        return this.settingsService.bulkUpdate(companyId, data);
    }
}
