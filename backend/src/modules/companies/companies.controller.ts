import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { Company as CompanyDecorator } from '../../common/decorators/company.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Permission } from '../auth/constants/permissions';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('companies')
@Controller('companies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CompaniesController {
    constructor(private readonly companiesService: CompaniesService) { }

    @Get('me')
    @ApiOperation({ summary: 'Obter dados da empresa atual' })
    findMyCompany(@CompanyDecorator() companyId: string) {
        return this.companiesService.findOne(companyId);
    }

    @Patch('branding')
    @RequirePermission(Permission.SETTINGS_UPDATE)
    @ApiOperation({ summary: 'Atualizar branding da empresa' })
    updateBranding(
        @CompanyDecorator() companyId: string,
        @Body() brandingData: UpdateBrandingDto
    ) {
        return this.companiesService.updateBranding(companyId, brandingData);
    }

    @Get()
    @RequirePermission(Permission.SETTINGS_READ)
    @ApiOperation({ summary: 'Listar todas as empresas (admin)' })
    findAll() {
        return this.companiesService.findAll();
    }

    @Post()
    @RequirePermission(Permission.SETTINGS_UPDATE)
    @ApiOperation({ summary: 'Criar uma empresa (admin)' })
    create(@Body() data: CreateCompanyDto) {
        return this.companiesService.create(data);
    }

    @Patch(':id')
    @RequirePermission(Permission.SETTINGS_UPDATE)
    @ApiOperation({ summary: 'Atualizar uma empresa (admin)' })
    update(@Param('id') id: string, @Body() data: UpdateCompanyDto) {
        return this.companiesService.update(id, data);
    }

    @Delete(':id')
    @RequirePermission(Permission.SETTINGS_UPDATE)
    @ApiOperation({ summary: 'Excluir uma empresa (admin)' })
    remove(@Param('id') id: string) {
        return this.companiesService.remove(id);
    }
}
