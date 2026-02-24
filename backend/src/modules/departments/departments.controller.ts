import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { Company } from '../../common/decorators/company.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { Permission } from '../auth/constants/permissions';
import { SubscriptionLimit } from '../../common/decorators/subscription-limit.decorator';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('departments')
export class DepartmentsController {
    constructor(private readonly departmentsService: DepartmentsService) { }

    @Post()
    @UseGuards(SubscriptionGuard)
    @SubscriptionLimit('maxDepartments')
    @RequirePermission(Permission.DEPARTMENTS_CREATE)
    @ApiOperation({ summary: 'Criar um novo departamento' })
    @ApiResponse({ status: 201, description: 'Departamento criado com sucesso.' })
    create(@Body() createDepartmentDto: CreateDepartmentDto, @Company() companyId: string) {
        return this.departmentsService.create(createDepartmentDto, companyId);
    }

    @Get()
    @RequirePermission(Permission.DEPARTMENTS_READ)
    @ApiOperation({ summary: 'Listar todos os departamentos' })
    findAll(@Company() companyId: string) {
        return this.departmentsService.findAll(companyId);
    }

    @Get(':id')
    @RequirePermission(Permission.DEPARTMENTS_READ)
    @ApiOperation({ summary: 'Obter um departamento pelo ID' })
    findOne(@Param('id') id: string, @Company() companyId: string) {
        return this.departmentsService.findOne(id, companyId);
    }

    @Patch(':id')
    @RequirePermission(Permission.DEPARTMENTS_UPDATE)
    @ApiOperation({ summary: 'Atualizar um departamento' })
    update(
        @Param('id') id: string,
        @Body() updateDepartmentDto: UpdateDepartmentDto,
        @Company() companyId: string,
    ) {
        return this.departmentsService.update(id, updateDepartmentDto, companyId);
    }

    @Delete(':id')
    @RequirePermission(Permission.DEPARTMENTS_DELETE)
    @ApiOperation({ summary: 'Excluir um departamento' })
    remove(@Param('id') id: string, @Company() companyId: string) {
        return this.departmentsService.remove(id, companyId);
    }
}
