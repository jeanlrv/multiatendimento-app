import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge.dto';
import { AddDocumentDto } from './dto/add-document.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { S3Service } from '../storage/s3.service';

@Injectable()
export class KnowledgeService {
    private readonly logger = new Logger(KnowledgeService.name);

    constructor(
        private prisma: PrismaService,
        @InjectQueue('knowledge-processing') private knowledgeQueue: Queue,
        private s3Service: S3Service,
        private eventEmitter: EventEmitter2,
    ) { }

    /** Emite evento que invalida o cache semântico do AIService para esta base */
    private emitKnowledgeUpdated(knowledgeBaseId: string, companyId: string) {
        this.eventEmitter.emit('knowledge.updated', { knowledgeBaseId, companyId });
    }

    async createBase(companyId: string, data: CreateKnowledgeBaseDto) {
        return (this.prisma as any).knowledgeBase.create({
            data: {
                ...data,
                companyId,
            },
        });
    }

    async findAllBases(companyId: string) {
        return (this.prisma as any).knowledgeBase.findMany({
            where: { companyId },
            include: {
                _count: {
                    select: { documents: true }
                }
            }
        });
    }

    async findOneBase(companyId: string, id: string) {
        const base = await (this.prisma as any).knowledgeBase.findFirst({
            where: { id, companyId },
            include: {
                documents: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!base) throw new NotFoundException('Base de conhecimento não encontrada');
        return base;
    }

    async removeBase(companyId: string, id: string) {
        return (this.prisma as any).knowledgeBase.deleteMany({
            where: { id, companyId }
        });
    }

    async addDocument(companyId: string, baseId: string, data: AddDocumentDto) {
        // Verifica se a base pertence à empresa
        await this.findOneBase(companyId, baseId);

        const document = await (this.prisma as any).document.create({
            data: {
                ...data,
                knowledgeBaseId: baseId,
                status: 'PENDING',
            },
        });

        // Envia para a fila de processamento
        await this.enqueueProcessing(document.id, companyId);
        this.emitKnowledgeUpdated(baseId, companyId);

        return document;
    }

    async addDocumentFromFile(companyId: string, baseId: string, file: Express.Multer.File) {
        await this.findOneBase(companyId, baseId);

        const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
        const sourceType = detectSourceType(ext);

        // Determinar o content type para S3
        const contentType = getMimeType(ext);

        // Fazer upload para S3
        let contentUrl = file.path; // fallback para path local
        try {
            contentUrl = await this.s3Service.uploadFile(file.path, file.originalname, contentType);
            // Remover arquivo local após upload bem-sucedido
            const fs = require('fs');
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        } catch (error) {
            this.logger.warn(`Falha ao fazer upload para S3, usando armazenamento local: ${error.message}`);
            // Continua usando o path local em caso de falha no S3
        }

        const document = await (this.prisma as any).document.create({
            data: {
                title: file.originalname,
                sourceType,
                contentUrl, // Agora pode ser URL S3 ou path local
                knowledgeBaseId: baseId,
                status: 'PENDING',
            },
        });

        await this.enqueueProcessing(document.id, companyId);
        this.emitKnowledgeUpdated(baseId, companyId);

        return document;
    }

    private async enqueueProcessing(documentId: string, companyId: string) {
        await this.knowledgeQueue.add('process-document', {
            documentId,
            companyId,
        }, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
        });
    }

    async getDocumentStatus(companyId: string, documentId: string) {
        const doc = await (this.prisma as any).document.findFirst({
            where: {
                id: documentId,
                knowledgeBase: { companyId }
            },
            select: {
                id: true,
                title: true,
                status: true,
                chunkCount: true,
                createdAt: true
            }
        });

        if (!doc) throw new NotFoundException('Documento não encontrado');
        return doc;
    }

    async removeDocument(companyId: string, documentId: string) {
        const doc = await (this.prisma as any).document.findFirst({
            where: { id: documentId, knowledgeBase: { companyId } }
        });

        if (!doc) return { count: 0 };

        // Deletar chunks primeiro (cascade manual se necessário, embora Prisma deva lidar se configurado)
        await (this.prisma as any).documentChunk.deleteMany({
            where: { documentId }
        });

        if (doc.contentUrl && !doc.contentUrl.startsWith('http')) {
            try {
                const fs = require('fs');
                if (fs.existsSync(doc.contentUrl)) fs.unlinkSync(doc.contentUrl);
            } catch (error) {
                this.logger.error(`Erro ao remover arquivo físico: ${error.message}`);
            }
        } else if (doc.contentUrl && doc.contentUrl.startsWith('http')) {
            try {
                await this.s3Service.deleteFile(doc.contentUrl);
            } catch (error) {
                this.logger.error(`Erro ao remover arquivo do S3: ${error.message}`);
            }
        }

        const deleted = await (this.prisma as any).document.deleteMany({
            where: {
                id: documentId,
                knowledgeBase: { companyId }
            }
        });
        if (doc?.knowledgeBaseId) this.emitKnowledgeUpdated(doc.knowledgeBaseId, companyId);
        return deleted;
    }

    async batchRemoveDocuments(companyId: string, documentIds: string[]) {
        if (!documentIds || documentIds.length === 0) return { count: 0 };

        const docs = await (this.prisma as any).document.findMany({
            where: {
                id: { in: documentIds },
                knowledgeBase: { companyId }
            }
        });

        if (docs.length === 0) return { count: 0 };

        const baseIds = [...new Set(docs.map((d: any) => d.knowledgeBaseId))];

        for (const doc of docs) {
            // Remover chunks
            await (this.prisma as any).documentChunk.deleteMany({
                where: { documentId: doc.id }
            });

            // Remover arquivo físico
            if (doc.contentUrl && !doc.contentUrl.startsWith('http')) {
                try {
                    const fs = require('fs');
                    if (fs.existsSync(doc.contentUrl)) fs.unlinkSync(doc.contentUrl);
                } catch (error) {
                    this.logger.error(`Erro ao remover arquivo físico (${doc.id}): ${error.message}`);
                }
            } else if (doc.contentUrl && doc.contentUrl.startsWith('http')) {
                try {
                    await this.s3Service.deleteFile(doc.contentUrl);
                } catch (error) {
                    this.logger.error(`Erro ao remover arquivo do S3 (${doc.id}): ${error.message}`);
                }
            }
        }

        const deleted = await (this.prisma as any).document.deleteMany({
            where: {
                id: { in: documentIds },
                knowledgeBase: { companyId }
            }
        });

        for (const baseId of baseIds) {
            this.emitKnowledgeUpdated(baseId as string, companyId);
        }

        return deleted;
    }

    async getDocumentFile(companyId: string, documentId: string) {
        const doc = await (this.prisma as any).document.findFirst({
            where: {
                id: documentId,
                knowledgeBase: { companyId }
            }
        });

        if (!doc) throw new NotFoundException('Documento não encontrado');
        if (!doc.contentUrl) throw new BadRequestException('Documento não possui arquivo físico (ex: fonte de texto/URL)');

        return doc;
    }

    async createBulkDownloadZip(companyId: string, documentIds: string[]) {
        const docs = await (this.prisma as any).document.findMany({
            where: {
                id: { in: documentIds },
                knowledgeBase: { companyId },
                contentUrl: { not: null }
            }
        });

        if (docs.length === 0) throw new BadRequestException('Nenhum documento com arquivo físico selecionado');

        const JSZip = require('jszip');
        const zip = new JSZip();
        const axios = require('axios');
        const fs = require('fs');

        for (const doc of docs) {
            try {
                let fileData: Buffer;
                if (doc.contentUrl.startsWith('http')) {
                    const response = await axios.get(doc.contentUrl, { responseType: 'arraybuffer' });
                    fileData = Buffer.from(response.data);
                } else {
                    if (fs.existsSync(doc.contentUrl)) {
                        fileData = fs.readFileSync(doc.contentUrl);
                    } else {
                        continue;
                    }
                }
                zip.file(doc.title, fileData);
            } catch (error) {
                this.logger.error(`Erro ao adicionar arquivo ${doc.title} ao ZIP: ${error.message}`);
            }
        }

        return zip.generateAsync({ type: 'nodebuffer' });
    }

    /**
     * Reprocessa TODOS os documentos de uma base de conhecimento.
     * Usa operações em lote para evitar timeout em bases com muitos documentos.
     */
    async reprocessBase(companyId: string, knowledgeBaseId: string) {
        const base = await this.findOneBase(companyId, knowledgeBaseId);

        const docs = await (this.prisma as any).document.findMany({
            where: { knowledgeBaseId: base.id },
            select: { id: true },
        });

        if (docs.length === 0) {
            return { message: 'Nenhum documento na base', count: 0 };
        }

        const docIds = docs.map((d: any) => d.id);

        // 1. Apaga todos os chunks da base em uma única query (muito mais rápido que N deleteMany)
        await (this.prisma as any).documentChunk.deleteMany({
            where: { documentId: { in: docIds } },
        });

        // 2. Marca todos os documentos como PENDING em uma única query
        await (this.prisma as any).document.updateMany({
            where: { id: { in: docIds } },
            data: { status: 'PENDING' },
        });

        // 3. Enfileira todos em paralelo (BullMQ é assíncrono — não bloqueia)
        await Promise.all(docIds.map((id: string) => this.enqueueProcessing(id, companyId)));

        this.emitKnowledgeUpdated(knowledgeBaseId, companyId);
        return { message: `${docIds.length} documento(s) enviado(s) para reprocessamento`, count: docIds.length };
    }

    async reprocessDocument(companyId: string, documentId: string) {
        // Verificar se o documento existe e pertence à empresa
        const doc = await (this.prisma as any).document.findFirst({
            where: { id: documentId, knowledgeBase: { companyId } }
        });

        if (!doc) {
            throw new Error('Documento não encontrado');
        }

        // Atualizar status para PENDING
        await (this.prisma as any).document.update({
            where: { id: documentId },
            data: { status: 'PENDING' }
        });

        // Remover chunks existentes
        await (this.prisma as any).documentChunk.deleteMany({
            where: { documentId }
        });

        // Enviar para fila de processamento
        await this.enqueueProcessing(documentId, companyId);
        this.emitKnowledgeUpdated(doc.knowledgeBaseId, companyId);

        return { message: 'Documento enviado para reprocessamento' };
    }

    // ========== Edição de Bases de Conhecimento ==========

    async updateBase(companyId: string, id: string, data: { name?: string; description?: string; language?: string }) {
        // Verifica se a base pertence à empresa
        const base = await this.findOneBase(companyId, id);

        // Validações
        if (data.name && data.name.length < 2) {
            throw new BadRequestException('Nome deve ter pelo menos 2 caracteres');
        }
        if (data.name && data.name.length > 100) {
            throw new BadRequestException('Nome não pode exceder 100 caracteres');
        }

        return (this.prisma as any).knowledgeBase.update({
            where: { id },
            data
        });
    }

    async updateBaseDescription(companyId: string, id: string, description: string) {
        const base = await this.findOneBase(companyId, id);

        return (this.prisma as any).knowledgeBase.update({
            where: { id },
            data: { description }
        });
    }

    async updateBaseLanguage(companyId: string, id: string, language: string) {
        const base = await this.findOneBase(companyId, id);

        return (this.prisma as any).knowledgeBase.update({
            where: { id },
            data: { language }
        });
    }

    async getBaseStats(companyId: string, id: string) {
        const base = await this.findOneBase(companyId, id);

        // Contagem de documentos por status
        const documentsByStatus = await (this.prisma as any).document.groupBy({
            by: ['status'],
            where: { knowledgeBaseId: id },
            _count: true
        });

        // Total de chunks
        const totalChunks = await (this.prisma as any).documentChunk.aggregate({
            where: { knowledgeBaseId: id },
            _count: true
        });

        // Total de tokens estimados (150 chars por chunk)
        const totalTokens = totalChunks._count * 150;

        return {
            id: base.id,
            name: base.name,
            totalDocuments: base._count.documents,
            documentsByStatus,
            totalChunks: totalChunks._count,
            estimatedTokens: totalTokens
        };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Mapeamentos auxiliares de extensão → sourceType e MIME type
// ──────────────────────────────────────────────────────────────────────────────

const EXT_TO_SOURCE_TYPE: Record<string, string> = {
    // Documentos Office
    pdf: 'PDF',
    doc: 'DOCX',
    docx: 'DOCX',
    xls: 'XLS',
    xlsx: 'XLSX',
    ppt: 'PPTX',
    pptx: 'PPTX',
    epub: 'EPUB',
    // Texto
    txt: 'TXT',
    md: 'MD',
    mdx: 'MD',
    markdown: 'MD',
    rtf: 'RTF',
    // Web
    html: 'HTML',
    htm: 'HTML',
    // Dados
    csv: 'CSV',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    xml: 'XML',
    // Código
    js: 'CODE', ts: 'CODE', jsx: 'CODE', tsx: 'CODE',
    py: 'CODE', java: 'CODE', go: 'CODE', rb: 'CODE',
    php: 'CODE', cs: 'CODE', cpp: 'CODE', c: 'CODE',
    rs: 'CODE', swift: 'CODE', kt: 'CODE', sh: 'CODE',
    bash: 'CODE', sql: 'CODE',
    // Áudio
    mp3: 'AUDIO', wav: 'AUDIO', mp4: 'AUDIO',
    ogg: 'AUDIO', webm: 'AUDIO', m4a: 'AUDIO', mpeg: 'AUDIO',
};

const EXT_TO_MIME: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt: 'application/vnd.ms-powerpoint',
    epub: 'application/epub+zip',
    txt: 'text/plain',
    md: 'text/markdown',
    html: 'text/html',
    htm: 'text/html',
    csv: 'text/csv',
    json: 'application/json',
    xml: 'application/xml',
    yaml: 'application/yaml',
    yml: 'application/yaml',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'audio/mp4',
    ogg: 'audio/ogg',
    webm: 'audio/webm',
    m4a: 'audio/mp4',
};

export function detectSourceType(ext: string): string {
    return EXT_TO_SOURCE_TYPE[ext.toLowerCase()] || 'TEXT';
}

export function getMimeType(ext: string): string {
    return EXT_TO_MIME[ext.toLowerCase()] || 'application/octet-stream';
}
