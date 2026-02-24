import { Controller, Get, Post, Body, Query, UseGuards, Param, Patch, Delete, Header, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { Company } from '../../common/decorators/company.decorator';

@ApiTags('contacts')
@Controller('contacts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContactsController {
    constructor(private readonly contactsService: ContactsService) { }

    @Post()
    @ApiOperation({ summary: 'Criar um novo contato' })
    create(@Body() createContactDto: CreateContactDto, @Company() companyId: string) {
        return this.contactsService.create(createContactDto, companyId);
    }

    @Get()
    @ApiOperation({ summary: 'Listar todos os contatos' })
    findAll(
        @Company() companyId: string,
        @Query('search') search?: string,
        @Query('page') page = 1,
        @Query('limit') limit = 10,
    ) {
        return this.contactsService.findAll(companyId, search, Number(page), Number(limit));
    }

    @Post('import')
    @ApiOperation({ summary: 'Importar contatos via CSV (upsert por telefone)' })
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
    async importCSV(
        @Company() companyId: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) throw new BadRequestException('Arquivo CSV não enviado');
        if (!file.originalname.toLowerCase().endsWith('.csv') && file.mimetype !== 'text/csv') {
            throw new BadRequestException('Apenas arquivos .csv são aceitos');
        }
        return this.contactsService.importCSV(companyId, file.buffer);
    }

    @Get('export/csv')
    @ApiOperation({ summary: 'Exportar contatos em CSV' })
    @Header('Content-Type', 'text/csv; charset=utf-8')
    @Header('Content-Disposition', 'attachment; filename=contatos.csv')
    exportCSV(@Company() companyId: string) {
        return this.contactsService.exportCSV(companyId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obter detalhes de um contato' })
    findOne(@Company() companyId: string, @Param('id') id: string) {
        return this.contactsService.findOne(companyId, id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Atualizar um contato' })
    update(
        @Company() companyId: string,
        @Param('id') id: string,
        @Body() data: UpdateContactDto,
    ) {
        return this.contactsService.update(companyId, id, data);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Excluir um contato' })
    remove(@Company() companyId: string, @Param('id') id: string) {
        return this.contactsService.remove(companyId, id);
    }
}
