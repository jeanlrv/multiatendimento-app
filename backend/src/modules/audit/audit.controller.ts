import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { Company } from '../../common/decorators/company.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { Permission } from '../auth/constants/permissions';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
    constructor(private readonly auditService: AuditService) { }

    @Get()
    @RequirePermission(Permission.AUDIT_READ)
    @ApiOperation({ summary: 'Listar logs de auditoria da empresa' })
    findAll(
        @Company() companyId: string,
        @Query('action') action?: string,
        @Query('entity') entity?: string,
        @Query('userId') userId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ) {
        return this.auditService.findAll({
            companyId,
            action,
            entity,
            userId,
            startDate,
            endDate,
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 50,
        });
    }
}
