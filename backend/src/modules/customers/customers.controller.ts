import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Company } from '../../common/decorators/company.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { Permission } from '../auth/constants/permissions';

@ApiTags('customers')
@Controller('customers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CustomersController {
    constructor(private readonly customersService: CustomersService) {}

    // ─── CRUD ─────────────────────────────────────────────────────────────────

    @Post()
    @RequirePermission(Permission.CUSTOMERS_CREATE)
    @ApiOperation({ summary: 'Criar cliente' })
    create(@Body() dto: CreateCustomerDto, @Company() companyId: string) {
        return this.customersService.create(dto, companyId);
    }

    @Get()
    @RequirePermission(Permission.CUSTOMERS_READ)
    @ApiOperation({ summary: 'Listar clientes' })
    findAll(
        @Company() companyId: string,
        @Query('search') search?: string,
        @Query('status') status?: string,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
    ) {
        return this.customersService.findAll(companyId, search, status, Number(page), Number(limit));
    }

    @Get(':id')
    @RequirePermission(Permission.CUSTOMERS_READ)
    @ApiOperation({ summary: 'Detalhes do cliente' })
    findOne(@Company() companyId: string, @Param('id') id: string) {
        return this.customersService.findOne(companyId, id);
    }

    @Patch(':id')
    @RequirePermission(Permission.CUSTOMERS_UPDATE)
    @ApiOperation({ summary: 'Atualizar cliente' })
    update(@Company() companyId: string, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
        return this.customersService.update(companyId, id, dto);
    }

    @Delete(':id')
    @RequirePermission(Permission.CUSTOMERS_DELETE)
    @ApiOperation({ summary: 'Excluir cliente' })
    remove(@Company() companyId: string, @Param('id') id: string) {
        return this.customersService.remove(companyId, id);
    }

    // ─── Contatos ─────────────────────────────────────────────────────────────

    @Get(':id/contacts')
    @RequirePermission(Permission.CUSTOMERS_READ)
    @ApiOperation({ summary: 'Listar contatos do cliente' })
    findContacts(@Company() companyId: string, @Param('id') id: string) {
        return this.customersService.findContacts(companyId, id);
    }

    @Post(':id/contacts/:contactId')
    @RequirePermission(Permission.CUSTOMERS_UPDATE)
    @ApiOperation({ summary: 'Associar contato ao cliente' })
    linkContact(
        @Company() companyId: string,
        @Param('id') id: string,
        @Param('contactId') contactId: string,
    ) {
        return this.customersService.linkContact(companyId, id, contactId);
    }

    @Delete(':id/contacts/:contactId')
    @RequirePermission(Permission.CUSTOMERS_UPDATE)
    @ApiOperation({ summary: 'Desassociar contato do cliente' })
    unlinkContact(
        @Company() companyId: string,
        @Param('id') id: string,
        @Param('contactId') contactId: string,
    ) {
        return this.customersService.unlinkContact(companyId, id, contactId);
    }

    // ─── Conversas ────────────────────────────────────────────────────────────

    @Get(':id/conversations')
    @RequirePermission(Permission.CUSTOMERS_READ)
    @ApiOperation({ summary: 'Histórico de tickets do cliente' })
    findConversations(
        @Company() companyId: string,
        @Param('id') id: string,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
    ) {
        return this.customersService.findConversations(companyId, id, Number(page), Number(limit));
    }

    // ─── Notas ────────────────────────────────────────────────────────────────

    @Post(':id/notes')
    @RequirePermission(Permission.CUSTOMERS_UPDATE)
    @ApiOperation({ summary: 'Adicionar nota interna ao cliente' })
    addNote(
        @Company() companyId: string,
        @Param('id') id: string,
        @Body() body: { note: string },
        @Req() req: any,
    ) {
        return this.customersService.addNote(companyId, id, req.user.id, body.note);
    }

    @Delete(':id/notes/:noteId')
    @RequirePermission(Permission.CUSTOMERS_UPDATE)
    @ApiOperation({ summary: 'Remover nota interna' })
    removeNote(
        @Company() companyId: string,
        @Param('id') id: string,
        @Param('noteId') noteId: string,
    ) {
        return this.customersService.removeNote(companyId, id, noteId);
    }

    // ─── Tags ─────────────────────────────────────────────────────────────────

    @Post(':id/tags/:tagId')
    @RequirePermission(Permission.CUSTOMERS_UPDATE)
    @ApiOperation({ summary: 'Adicionar tag ao cliente' })
    addTag(
        @Company() companyId: string,
        @Param('id') id: string,
        @Param('tagId') tagId: string,
    ) {
        return this.customersService.addTag(companyId, id, tagId);
    }

    @Delete(':id/tags/:tagId')
    @RequirePermission(Permission.CUSTOMERS_UPDATE)
    @ApiOperation({ summary: 'Remover tag do cliente' })
    removeTag(
        @Company() companyId: string,
        @Param('id') id: string,
        @Param('tagId') tagId: string,
    ) {
        return this.customersService.removeTag(companyId, id, tagId);
    }

    // ─── Campos customizados ──────────────────────────────────────────────────

    @Post(':id/fields')
    @RequirePermission(Permission.CUSTOMERS_UPDATE)
    @ApiOperation({ summary: 'Adicionar/atualizar campo customizado' })
    upsertField(
        @Company() companyId: string,
        @Param('id') id: string,
        @Body() body: { fieldName: string; fieldValue: string; fieldType?: string },
    ) {
        return this.customersService.upsertCustomField(
            companyId, id, body.fieldName, body.fieldValue, body.fieldType,
        );
    }

    @Delete(':id/fields/:fieldName')
    @RequirePermission(Permission.CUSTOMERS_UPDATE)
    @ApiOperation({ summary: 'Remover campo customizado' })
    removeField(
        @Company() companyId: string,
        @Param('id') id: string,
        @Param('fieldName') fieldName: string,
    ) {
        return this.customersService.removeCustomField(companyId, id, fieldName);
    }

    // ─── Merge ────────────────────────────────────────────────────────────────

    @Post(':id/merge')
    @RequirePermission(Permission.CUSTOMERS_UPDATE)
    @ApiOperation({ summary: 'Mesclar dois clientes (source → target)' })
    merge(
        @Company() companyId: string,
        @Param('id') id: string,
        @Body() body: { targetCustomerId: string },
    ) {
        return this.customersService.mergeCustomers(companyId, id, body.targetCustomerId);
    }
}
