import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Req } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto, TicketStatus } from './dto/update-ticket.dto';
import { BulkTicketActionDto } from './dto/bulk-ticket-action.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Permission } from '../auth/constants/permissions';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Tickets')
@Controller('tickets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TicketsController {
    constructor(private readonly ticketsService: TicketsService) { }

    @Post()
    @RequirePermission(Permission.TICKETS_CREATE)
    @ApiOperation({ summary: 'Criar um novo ticket' })
    create(@Req() req: any, @Body() createTicketDto: CreateTicketDto) {
        return this.ticketsService.create(req.user.companyId, createTicketDto);
    }

    @Get()
    @RequirePermission(Permission.TICKETS_READ)
    @ApiOperation({ summary: 'Listar tickets com filtros e paginação' })
    @ApiQuery({ name: 'status', required: false, enum: TicketStatus })
    @ApiQuery({ name: 'departmentId', required: false })
    @ApiQuery({ name: 'assignedUserId', required: false })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'priority', required: false })
    @ApiQuery({ name: 'connectionId', required: false })
    @ApiQuery({ name: 'tags', required: false, isArray: true })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    @ApiQuery({ name: 'page', required: false, description: 'Página (começa em 1)', example: 1 })
    @ApiQuery({ name: 'limit', required: false, description: 'Itens por página (máx: 100)', example: 20 })
    findAll(
        @Req() req: any,
        @Query('status') status?: TicketStatus,
        @Query('departmentId') departmentId?: string,
        @Query('assignedUserId') assignedUserId?: string,
        @Query('search') search?: string,
        @Query('priority') priority?: string,
        @Query('connectionId') connectionId?: string,
        @Query('tags') tags?: string | string[],
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const user = req.user;
        // Usar permissions do JWT (DB-driven); fallback para array vazio
        const userPermissions: string[] = user.permissions || [];
        const hasReadAllPermission = userPermissions.includes(Permission.TICKETS_READ_ALL);
        const departamentosPermitidos = user.departments?.map((d: any) => d.id) || [];

        // Usuários com permissão global podem ver tudo da empresa. Outros precisam de departamentos vinculados.
        if (!hasReadAllPermission && departamentosPermitidos.length === 0) {
            return [];
        }

        let filtroDepartamentos = departmentId;

        // Se não tiver permissão global, aplicar restrição rigorosa de departamentos permitidos
        if (!hasReadAllPermission) {
            const filtrados = departmentId
                ? departmentId.split(',').filter(id => departamentosPermitidos.includes(id))
                : departamentosPermitidos;

            if (departmentId && filtrados.length === 0) {
                return [];
            }

            filtroDepartamentos = filtrados.join(',');
        }

        const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));

        return this.ticketsService.findAll(user.companyId, {
            status,
            departmentId: filtroDepartamentos,
            assignedUserId,
            search,
            priority,
            connectionId,
            tags,
            startDate,
            endDate,
            page: pageNum,
            limit: limitNum,
        });
    }

    @Get(':id')
    @RequirePermission(Permission.TICKETS_READ)
    @ApiOperation({ summary: 'Obter detalhes de um ticket' })
    findOne(@Req() req: any, @Param('id') id: string) {
        return this.ticketsService.findOne(req.user.companyId, id);
    }

    @Patch(':id')
    @RequirePermission(Permission.TICKETS_UPDATE)
    @ApiOperation({ summary: 'Atualizar um ticket' })
    update(@Req() req: any, @Param('id') id: string, @Body() updateTicketDto: UpdateTicketDto) {
        return this.ticketsService.update(req.user.companyId, id, updateTicketDto, req.user.id);
    }

    @Patch(':id/assign/:userId')
    @RequirePermission(Permission.TICKETS_ASSIGN)
    @ApiOperation({ summary: 'Atribuir ticket a um atendente' })
    assign(@Req() req: any, @Param('id') id: string, @Param('userId') userId: string) {
        return this.ticketsService.assign(req.user.companyId, id, userId, req.user.id);
    }

    @Post(':id/resolve')
    @RequirePermission(Permission.TICKETS_RESOLVE)
    @ApiOperation({ summary: 'Marcar ticket como resolvido' })
    resolve(@Req() req: any, @Param('id') id: string) {
        return this.ticketsService.resolve(req.user.companyId, id);
    }

    @Post(':id/pause')
    @RequirePermission(Permission.TICKETS_UPDATE)
    @ApiOperation({ summary: 'Pausar um ticket' })
    pause(@Req() req: any, @Param('id') id: string) {
        return this.ticketsService.pause(req.user.companyId, id);
    }

    @Delete(':id')
    @RequirePermission(Permission.TICKETS_DELETE)
    @ApiOperation({ summary: 'Excluir um ticket' })
    async remove(@Req() req: any, @Param('id') id: string) {
        return this.ticketsService.remove(req.user.companyId, id);
    }

    @Post('bulk')
    @RequirePermission(Permission.TICKETS_UPDATE)
    @ApiOperation({ summary: 'Executar ações em lote nos tickets' })
    bulkAction(@Req() req: any, @Body() bulkDto: BulkTicketActionDto) {
        return this.ticketsService.bulkAction(req.user.companyId, bulkDto);
    }
}
