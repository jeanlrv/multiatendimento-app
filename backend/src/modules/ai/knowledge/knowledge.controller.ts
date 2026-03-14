import { Controller, Get, Post, Patch, Body, Param, Delete, UseGuards, Req, UseInterceptors, UploadedFile, Res, Headers, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge.dto';
import { AddDocumentDto } from './dto/add-document.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';

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

    @Delete('documents/:id')
    @ApiOperation({ summary: 'Remover documento da base' })
    removeDocument(@Req() req: any, @Param('id') id: string) {
        return this.knowledgeService.removeDocument(req.user.companyId, id);
    }

    @Get('documents/:id/download')
    @ApiOperation({ summary: 'Baixar arquivo original do documento' })
    async downloadDocument(@Req() req: any, @Param('id') id: string, @Res() res: any) {
        const doc = await this.knowledgeService.getDocumentFile(req.user.companyId, id);

        if (doc.contentUrl && doc.contentUrl.startsWith('http')) {
            return res.redirect(doc.contentUrl);
        } else if (doc.contentUrl) {
            // Se for arquivo local
            if (!fs.existsSync(doc.contentUrl)) {
                return res.status(404).json({ message: 'Arquivo físico não encontrado no servidor' });
            }
            return res.download(doc.contentUrl, doc.title);
        } else if (doc.rawContent) {
            // Fallback para o texto extraído caso o arquivo tenha sido processado só em memória
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.title)}.txt"`);
            return res.send(doc.rawContent);
        } else {
            return res.status(404).json({ message: 'Documento não possui arquivo físico ou texto extraído para download.' });
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
                language: { type: 'string', example: 'pt-BR' },
                embeddingProvider: { type: 'string', example: 'native' },
                embeddingModel: { type: 'string', example: 'Xenova/all-MiniLM-L6-v2' }
            }
        }
    })
    updateBase(@Req() req: any, @Param('id') id: string, @Body() data: { name?: string; description?: string; language?: string; embeddingProvider?: string; embeddingModel?: string }) {
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

    // ========== Integração Local (Agente Windows) ==========

    @Post('bases/:id/webhook')
    @ApiOperation({ summary: 'Ativar integração local (Agente Windows) — gera ou retorna API key existente' })
    enableWebhook(@Req() req: any, @Param('id') id: string) {
        return this.knowledgeService.enableWebhook(id, req.user.companyId);
    }

    @Delete('bases/:id/webhook')
    @ApiOperation({ summary: 'Desativar integração local' })
    async disableWebhook(@Req() req: any, @Param('id') id: string) {
        await this.knowledgeService.disableWebhook(id, req.user.companyId);
        return { ok: true };
    }

    @Post('bases/:id/webhook/rotate')
    @ApiOperation({ summary: 'Rotacionar API key da integração local (invalida a anterior)' })
    rotateWebhookKey(@Req() req: any, @Param('id') id: string) {
        return this.knowledgeService.rotateWebhookKey(id, req.user.companyId);
    }

    @Get('bases/:id/sync-logs')
    @ApiOperation({ summary: 'Log de sincronizações do Agente Windows' })
    getSyncLogs(
        @Req() req: any,
        @Param('id') id: string,
        @Query('limit') limit?: string,
    ) {
        return this.knowledgeService.getSyncLogs(id, req.user.companyId, limit ? parseInt(limit) : 50);
    }

    // Ping: valida a chave sem processar nenhum arquivo (usado pelo agente para testar conexão)
    @Public()
    @Get('webhook/:apiKey/ping')
    async webhookPing(@Param('apiKey') apiKey: string) {
        await this.knowledgeService.findKbByWebhookKey(apiKey);
        return { ok: true, message: 'Integração ativa e chave válida.' };
    }

    // Endpoint PÚBLICO — chamado pelo Agente Windows (sem JWT)
    @Public()
    @Post('webhook/:apiKey/upload')
    @ApiOperation({ summary: '[Público] Upload de arquivo via Agente Windows — substitui doc de mesmo nome' })
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: os.tmpdir(),
            filename: (_req: any, file: any, cb: any) => {
                cb(null, `kwh-${Date.now()}-${file.originalname}`);
            },
        }),
        limits: { fileSize: 50 * 1024 * 1024 },
    }))
    async webhookUpload(
        @Param('apiKey') apiKey: string,
        @UploadedFile() file: Express.Multer.File,
        @Headers('x-agent-hostname') agentHostname?: string,
    ) {
        const kb = await this.knowledgeService.findKbByWebhookKey(apiKey);
        return this.knowledgeService.ingestFileFromWebhook(kb, file, agentHostname);
    }
}
