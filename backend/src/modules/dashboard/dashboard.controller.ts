import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
    constructor(
        private readonly dashboardService: DashboardService,
        private readonly reportsService: ReportsService
    ) { }

    @Get('stats')
    @ApiOperation({ summary: 'Obter estatísticas globais para o dashboard' })
    async getStats(@Req() req: any, @Query() query: any) {
        return this.dashboardService.getStats(req.user.companyId, query);
    }

    @Get('agent-ranking')
    @ApiOperation({ summary: 'Ranking de agentes por tickets resolvidos' })
    async getAgentRanking(@Req() req: any, @Query() query: any) {
        return this.dashboardService.getAgentRanking(req.user.companyId, query);
    }

    @Get('heatmap')
    @ApiOperation({ summary: 'Heatmap de volume de tickets por hora e dia da semana' })
    async getHeatmap(@Req() req: any, @Query() query: any) {
        return this.dashboardService.getHeatmap(req.user.companyId, query);
    }

    @Post('send-report')
    @ApiOperation({ summary: 'Enviar relatório diário por e-mail' })
    async sendReport(@Req() req: any, @Body() body: { email: string }) {
        return this.reportsService.sendDailyReport(req.user.companyId, body.email);
    }
}

