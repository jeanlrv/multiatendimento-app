import { Controller, Get, Post, Patch, Body, Param, Delete, UseGuards, Req, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as os from 'os';
import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge.dto';
import { AddDocumentDto } from './dto/add-document.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

const UPLOAD_OPTIONS = {
    storage: diskStorage({
        destination: os.tmpdir(),
        filename: (_req: any, file: any, cb: any) => {
            const ext = path.extname(file.originalname);
            cb(null, `upload-${Date.now()}${ext}`);
        },
    }),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
};

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
    @ApiOperation({ summary: 'Enviar arquivo para a base de conhecimento (PDF, DOCX, XLSX, PPTX, EPUB, MD, TXT, CSV, JSON, YAML, HTML, áudio, código, etc.)' })
    @UseInterceptors(FileInterceptor('file', UPLOAD_OPTIONS))
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

    @Delete('documents/bulk')
    @ApiOperation({ summary: 'Remover múltiplos documentos' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                ids: { type: 'array', items: { type: 'string' } }
            }
        }
    })
    batchRemoveDocuments(@Req() req: any, @Body('ids') ids: string[]) {
        return this.knowledgeService.batchRemoveDocuments(req.user.companyId, ids);
    }

    @Get('documents/:id/download')
    @ApiOperation({ summary: 'Baixar arquivo original do documento' })
    async downloadDocument(@Req() req: any, @Param('id') id: string, @Res() res: any) {
        const doc = await this.knowledgeService.getDocumentFile(req.user.companyId, id);

        if (doc.contentUrl.startsWith('http')) {
            // Se for S3, redirecionar para a URL (ou poderíamos fazer stream se fosse privado, 
            // mas aqui assume-se acessível ou o usuário quer a URL)
            return res.redirect(doc.contentUrl);
        } else {
            // Se for arquivo local
            const fs = require('fs');
            if (!fs.existsSync(doc.contentUrl)) {
                return res.status(404).json({ message: 'Arquivo físico não encontrado no servidor' });
            }
            return res.download(doc.contentUrl, doc.title);
        }
    }

    @Post('documents/download-bulk')
    @ApiOperation({ summary: 'Baixar múltiplos arquivos em um ZIP' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                ids: { type: 'array', items: { type: 'string' } }
            }
        }
    })
    async downloadBulkDocuments(@Req() req: any, @Body('ids') ids: string[], @Res() res: any) {
        const zipBuffer = await this.knowledgeService.createBulkDownloadZip(req.user.companyId, ids);

        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename=knowledge-base-documents.zip`,
            'Content-Length': zipBuffer.length,
        });

        res.end(zipBuffer);
    }

    @Post('documents/:id/reprocess')
    @ApiOperation({ summary: 'Reprocessar documento com erro' })
    reprocessDocument(@Req() req: any, @Param('id') id: string) {
        return this.knowledgeService.reprocessDocument(req.user.companyId, id);
    }

    @Post('bases/:id/reprocess-all')
    @ApiOperation({ summary: 'Reprocessar todos os documentos da base (corrige embeddings nulos ou troca de provider)' })
    reprocessBase(@Req() req: any, @Param('id') id: string) {
        return this.knowledgeService.reprocessBase(req.user.companyId, id);
    }

    // ========== Edição de Bases de Conhecimento ==========

    @Patch('bases/:id')
    @ApiOperation({ summary: 'Atualizar base de conhecimento' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string', example: 'Base de Conhecimento Atualizada' },
                description: { type: 'string', example: 'Descrição atualizada' },
                language: { type: 'string', example: 'pt-BR' }
            }
        }
    })
    updateBase(@Req() req: any, @Param('id') id: string, @Body() data: { name?: string; description?: string; language?: string }) {
        return this.knowledgeService.updateBase(req.user.companyId, id, data);
    }

    @Patch('bases/:id/description')
    @ApiOperation({ summary: 'Atualizar descrição da base' })
    updateBaseDescription(@Req() req: any, @Param('id') id: string, @Body('description') description: string) {
        return this.knowledgeService.updateBaseDescription(req.user.companyId, id, description);
    }

    @Patch('bases/:id/language')
    @ApiOperation({ summary: 'Atualizar idioma da base' })
    updateBaseLanguage(@Req() req: any, @Param('id') id: string, @Body('language') language: string) {
        return this.knowledgeService.updateBaseLanguage(req.user.companyId, id, language);
    }

    @Get('bases/:id/stats')
    @ApiOperation({ summary: 'Obter estatísticas da base de conhecimento' })
    getBaseStats(@Req() req: any, @Param('id') id: string) {
        return this.knowledgeService.getBaseStats(req.user.companyId, id);
    }
}
