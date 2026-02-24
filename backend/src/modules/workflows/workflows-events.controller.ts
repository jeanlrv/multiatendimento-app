import { Controller, Post, Body, Logger, UseGuards } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Company } from '../../common/decorators/company.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '../auth/constants/permissions';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('Workflows')
@Controller('workflows/events')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkflowEventsController {
    private readonly logger = new Logger(WorkflowEventsController.name);

    constructor(
        private readonly eventEmitter: EventEmitter2,
    ) { }

    @Post()
    @RequirePermission(Permission.WORKFLOWS_CREATE)
    @ApiOperation({ summary: 'Disparar evento manualmente para testar workflows (apenas admin/manager)' })
    async triggerEvent(
        @Company() companyId: string,
        @Body()
        body: {
            eventName: string;
            correlationKey?: string;
            payload?: any;
        },
    ) {
        this.logger.log(
            `Manual event dispatched by company ${companyId}: ${body.eventName} correlationKey=${body.correlationKey}`,
        );

        // Emite evento com companyId garantido do token JWT (não do payload)
        this.eventEmitter.emit(body.eventName, {
            ...(body.payload || {}),
            companyId,
        });

        return {
            success: true,
            message: 'Event dispatched successfully',
        };
    }
}
