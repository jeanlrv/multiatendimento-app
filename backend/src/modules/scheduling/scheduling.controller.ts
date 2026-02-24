import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Query,
    Delete,
    UseGuards,
    Req,
} from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { Permission } from '../auth/constants/permissions';
import { ScheduleStatus } from '@prisma/client';

@Controller('scheduling')
@UseGuards(JwtAuthGuard)
export class SchedulingController {
    constructor(private readonly schedulingService: SchedulingService) { }

    @Post()
    @RequirePermission(Permission.SCHEDULING_CREATE)
    create(@Req() req: any, @Body() data: any) {
        return this.schedulingService.createSchedule(req.user.companyId, data);
    }

    @Get()
    @RequirePermission(Permission.SCHEDULING_READ)
    findAll(
        @Req() req: any,
        @Query('departmentId') departmentId?: string,
        @Query('userId') userId?: string,
        @Query('contactId') contactId?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
    ) {
        return this.schedulingService.findAll(req.user.companyId, {
            departmentId,
            userId,
            contactId,
            start,
            end,
        });
    }

    @Patch(':id/status')
    @RequirePermission(Permission.SCHEDULING_UPDATE)
    updateStatus(
        @Req() req: any,
        @Param('id') id: string,
        @Body('status') status: ScheduleStatus,
    ) {
        return this.schedulingService.updateStatus(req.user.companyId, id, status);
    }

    @Patch(':id/time')
    @RequirePermission(Permission.SCHEDULING_UPDATE)
    updateTime(
        @Req() req: any,
        @Param('id') id: string,
        @Body()
        body: {
            startTime: string;
            endTime: string;
        },
    ) {
        return this.schedulingService.updateTime(req.user.companyId, id, body);
    }

    @Delete(':id')
    @RequirePermission(Permission.SCHEDULING_DELETE)
    remove(@Req() req: any, @Param('id') id: string) {
        return this.schedulingService.delete(req.user.companyId, id);
    }
}
