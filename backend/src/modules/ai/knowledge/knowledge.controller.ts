import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge.dto';
import { AddDocumentDto } from './dto/add-document.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('AI Knowledge')
@Controller('ai/knowledge')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KnowledgeController {
    constructor(private readonly knowledgeService: KnowledgeService) { }

    @Post('bases')
    @ApiOperation({ summary: 'Criar uma nova base de conhecimento' })
    createBase(@Req() req: any, @Body() dto: CreateKnowledgeBaseDto) {
        return this.knowledgeService.createBase(req.user.companyId, dto);
    }

    @Get('bases')
    @ApiOperation({ summary: 'Listar todas as bases de conhecimento' })
    findAllBases(@Req() req: any) {
        return this.knowledgeService.findAllBases(req.user.companyId);
    }

    @Get('bases/:id')
    @ApiOperation({ summary: 'Obter detalhes de uma base de conhecimento' })
    findOneBase(@Req() req: any, @Param('id') id: string) {
        return this.knowledgeService.findOneBase(req.user.companyId, id);
    }

    @Delete('bases/:id')
    @ApiOperation({ summary: 'Remover uma base de conhecimento' })
    removeBase(@Req() req: any, @Param('id') id: string) {
        return this.knowledgeService.removeBase(req.user.companyId, id);
    }

    @Post('bases/:id/documents')
    @ApiOperation({ summary: 'Adicionar um documento à base' })
    addDocument(@Req() req: any, @Param('id') id: string, @Body() dto: AddDocumentDto) {
        return this.knowledgeService.addDocument(req.user.companyId, id, dto);
    }

    @Post('bases/:id/upload')
    @ApiOperation({ summary: 'Enviar arquivo para a base de conhecimento' })
    @UseInterceptors(FileInterceptor('file'))
    uploadDocument(
        @Req() req: any,
        @Param('id') id: string,
        @UploadedFile() file: Express.Multer.File
    ) {
        return this.knowledgeService.addDocumentFromFile(req.user.companyId, id, file);
    }

    @Get('documents/:id/status')
    @ApiOperation({ summary: 'Verificar status de processamento do documento' })
    getDocumentStatus(@Req() req: any, @Param('id') id: string) {
        return this.knowledgeService.getDocumentStatus(req.user.companyId, id);
    }

    @Delete('documents/:id')
    @ApiOperation({ summary: 'Remover documento da base' })
    removeDocument(@Req() req: any, @Param('id') id: string) {
        return this.knowledgeService.removeDocument(req.user.companyId, id);
    }

    @Post('documents/:id/reprocess')
    @ApiOperation({ summary: 'Reprocessar documento com erro' })
    reprocessDocument(@Req() req: any, @Param('id') id: string) {
        return this.knowledgeService.reprocessDocument(req.user.companyId, id);
    }
}
