import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Company } from '../../common/decorators/company.decorator';

@ApiTags('Settings - Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings/integrations')
export class IntegrationsController {
    constructor(private readonly integrationsService: IntegrationsService) { }

    @Post()
    @ApiOperation({ summary: 'Criar nova configuração de integração' })
    create(@Body() createDto: any, @Company() companyId: string) {
        return this.integrationsService.create(createDto, companyId);
    }

    @Get()
    @ApiOperation({ summary: 'Listar todas as integrações da empresa' })
    findAll(@Company() companyId: string) {
        return this.integrationsService.findAll(companyId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Buscar uma integração específica' })
    findOne(@Param('id') id: string, @Company() companyId: string) {
        return this.integrationsService.findOne(id, companyId);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Atualizar configuração de integração' })
    update(@Param('id') id: string, @Body() updateDto: any, @Company() companyId: string) {
        return this.integrationsService.update(id, updateDto, companyId);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Remover integração' })
    remove(@Param('id') id: string, @Company() companyId: string) {
        return this.integrationsService.remove(id, companyId);
    }
}
