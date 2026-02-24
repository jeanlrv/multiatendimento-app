import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { Company } from '../../common/decorators/company.decorator';
import { WorkflowsService } from './workflows.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { UpdateWorkflowDto } from './dtos/update-workflow.dto';
import { SimulateWorkflowDto } from './dtos/simulate-workflow.dto';
import { CreateWorkflowDto } from './dtos/create-workflow.dto';
import { Permission } from '../auth/constants/permissions';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Workflows')
@Controller('workflows')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@ApiBearerAuth()
export class WorkflowsController {
    constructor(private readonly workflowsService: WorkflowsService) { }

    @Get()
    @RequirePermission(Permission.WORKFLOWS_READ)
    @ApiOperation({ summary: 'Listar todas as regras de workflow' })
    findAllRules(@Company() companyId: string) {
        return this.workflowsService.findAllRules(companyId);
    }

    @Post()
    @RequirePermission(Permission.WORKFLOWS_CREATE)
    @ApiOperation({ summary: 'Criar nova regra de workflow' })
    createRule(@Company() companyId: string, @Body() data: CreateWorkflowDto) {
        return this.workflowsService.createRule(companyId, data);
    }

    @Patch(':id')
    @RequirePermission(Permission.WORKFLOWS_UPDATE)
    @ApiOperation({ summary: 'Atualizar uma regra de workflow' })
    updateRule(@Param('id') id: string, @Company() companyId: string, @Body() data: UpdateWorkflowDto) {
        return this.workflowsService.updateRule(id, companyId, data);
    }

    @Delete(':id')
    @RequirePermission(Permission.WORKFLOWS_DELETE)
    @ApiOperation({ summary: 'Excluir uma regra de workflow' })
    deleteRule(@Param('id') id: string, @Company() companyId: string) {
        return this.workflowsService.deleteRule(id, companyId);
    }

    @Post(':id/duplicate')
    @RequirePermission(Permission.WORKFLOWS_CREATE)
    @ApiOperation({ summary: 'Duplicar uma regra de workflow' })
    duplicateRule(@Param('id') id: string, @Company() companyId: string) {
        return this.workflowsService.duplicateRule(id, companyId);
    }

    @Get('executions')
    @RequirePermission(Permission.WORKFLOWS_READ)
    @ApiOperation({ summary: 'Listar histórico de execuções com paginação e filtros' })
    findAllExecutions(@Company() companyId: string, @Query() query: any) {
        return this.workflowsService.findAllExecutions(companyId, query);
    }

    @Get('analytics')
    @RequirePermission(Permission.WORKFLOWS_READ)
    @ApiOperation({ summary: 'Obter analytics global de workflows' })
    getAnalytics(@Company() companyId: string) {
        return this.workflowsService.getAnalytics(companyId);
    }

    @Get('stats/all')
    @RequirePermission(Permission.WORKFLOWS_READ)
    @ApiOperation({ summary: 'Obter estatísticas de todas as regras em uma query (N+1 free)' })
    getAllRuleStats(@Company() companyId: string) {
        return this.workflowsService.getAllRuleStats(companyId);
    }

    @Get(':id/stats')
    @RequirePermission(Permission.WORKFLOWS_READ)
    @ApiOperation({ summary: 'Obter estatísticas de uma regra específica' })
    getRuleStats(@Param('id') id: string, @Company() companyId: string) {
        return this.workflowsService.getRuleStats(id, companyId);
    }

    @Post('simulate')
    @RequirePermission(Permission.WORKFLOWS_READ)
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @ApiOperation({ summary: 'Simular execução de workflow (Dry-run)' })
    simulate(@Company() companyId: string, @Body() data: SimulateWorkflowDto) {
        return this.workflowsService.simulate(data, companyId);
    }

    @Post(':id/run')
    @RequirePermission(Permission.WORKFLOWS_UPDATE)
    @Throttle({ default: { limit: 10, ttl: 60000 } })
    @ApiOperation({ summary: 'Executar workflow manualmente' })
    runManual(@Param('id') id: string, @Company() companyId: string) {
        return this.workflowsService.runManual(id, companyId);
    }

    @Get(':id/versions')
    @RequirePermission(Permission.WORKFLOWS_READ)
    @ApiOperation({ summary: 'Listar versões de um workflow' })
    findAllVersions(@Param('id') id: string, @Company() companyId: string) {
        return this.workflowsService.findAllVersions(id, companyId);
    }

    @Post(':id/versions')
    @RequirePermission(Permission.WORKFLOWS_UPDATE)
    @ApiOperation({ summary: 'Criar nova versão de backup' })
    createVersion(@Param('id') id: string, @Company() companyId: string, @Body('description') description: string, @Req() req: any) {
        return this.workflowsService.createVersion(id, companyId, description, req.user.id);
    }

    @Post(':id/versions/:versionId/restore')
    @RequirePermission(Permission.WORKFLOWS_UPDATE)
    @ApiOperation({ summary: 'Restaurar versão de workflow' })
    restoreVersion(@Param('id') id: string, @Param('versionId') versionId: string, @Company() companyId: string) {
        return this.workflowsService.restoreVersion(id, companyId, versionId);
    }

    @Post('seed-default')
    @RequirePermission(Permission.WORKFLOWS_CREATE)
    @ApiOperation({ summary: 'Ativar o Aero Default Flow (Configuração inteligente padrão)' })
    seedDefault(@Company() companyId: string, @Body('aiAgentId') aiAgentId?: string) {
        return this.workflowsService.seedDefaultAeroWorkflow(companyId, aiAgentId);
    }
}
