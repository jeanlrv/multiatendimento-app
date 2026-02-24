import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'; // Assume auth guard exists
// import { RolesGuard } from '../../auth/guards/roles.guard';

@Controller('workflows/analytics')
// @UseGuards(JwtAuthGuard)
export class WorkflowAnalyticsController {
    constructor(private readonly prisma: PrismaService) { }

    @Get('summary')
    async getSummary(@Query('range') range: string = '7d') {
        const dateFilter = this.getDateFilter(range);

        const [totalExecutions, successRate, avgDuration] = await Promise.all([
            this.prisma.workflowExecution.count({ where: { executedAt: { gte: dateFilter } } }),
            this.getSuccessRate(dateFilter),
            this.prisma.workflowExecution.aggregate({
                _avg: { duration: true },
                where: { executedAt: { gte: dateFilter }, status: 'completed' }
            })
        ]);

        return {
            totalExecutions,
            successRate,
            avgDuration: avgDuration._avg.duration || 0
        };
    }

    @Get('metrics/:workflowId')
    async getWorkflowMetrics(@Param('workflowId') workflowId: string) {
        const actionMetrics = await this.prisma.workflowActionMetric.findMany({
            where: { workflowRuleId: workflowId },
            orderBy: { totalExecutions: 'desc' }
        });

        return actionMetrics;
    }

    @Get('heatmap')
    async getHeatmap(@Query('range') range: string = '7d') {
        // Implementation for heatmap aggregation (usually raw query needed or grouping)
        // Mocking for now as Prisma grouping is limited for time series without raw query
        return { message: 'Heatmap data structure' };
    }

    private getDateFilter(range: string): Date {
        const now = new Date();
        if (range === '24h') return new Date(now.setDate(now.getDate() - 1));
        if (range === '30d') return new Date(now.setDate(now.getDate() - 30));
        return new Date(now.setDate(now.getDate() - 7)); // Default 7d
    }

    private async getSuccessRate(dateFilter: Date): Promise<number> {
        const total = await this.prisma.workflowExecution.count({ where: { executedAt: { gte: dateFilter } } });
        if (total === 0) return 0;

        const success = await this.prisma.workflowExecution.count({
            where: {
                executedAt: { gte: dateFilter },
                status: 'completed'
            }
        });

        return (success / total) * 100;
    }
}
