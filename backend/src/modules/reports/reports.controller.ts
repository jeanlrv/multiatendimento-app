import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { Company } from '../../common/decorators/company.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { Permission } from '../auth/constants/permissions';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    @Get('stats')
    @RequirePermission(Permission.REPORTS_READ)
    @ApiOperation({ summary: 'Estatísticas gerais de tickets e mensagens' })
    getStats(
        @Company() companyId: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.reportsService.getDashboardStats(companyId, startDate, endDate);
    }

    @Get('performance')
    @RequirePermission(Permission.REPORTS_READ)
    @ApiOperation({ summary: 'Performance por agente' })
    getPerformance(
        @Company() companyId: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.reportsService.getAgentPerformance(companyId, startDate, endDate);
    }

    @Get('audit/internal-chat')
    @RequirePermission(Permission.AUDIT_READ)
    @ApiOperation({ summary: 'Auditoria de mensagens do chat interno' })
    getInternalChatAudit(
        @Company() companyId: string,
        @Query('query') query?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.reportsService.getInternalChatAudit(companyId, query, startDate, endDate);
    }
}
