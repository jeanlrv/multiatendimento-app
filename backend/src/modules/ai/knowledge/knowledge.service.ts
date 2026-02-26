import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
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
    ) { }

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

        return document;
    }

    async addDocumentFromFile(companyId: string, baseId: string, file: Express.Multer.File) {
        await this.findOneBase(companyId, baseId);

        const ext = file.originalname.split('.').pop()?.toUpperCase();
        let sourceType: 'PDF' | 'DOCX' | 'TEXT' = 'PDF';
        if (ext === 'DOCX') sourceType = 'DOCX';

        // Determinar o content type
        let contentType = 'application/octet-stream';
        if (sourceType === 'PDF') contentType = 'application/pdf';
        if (sourceType === 'DOCX') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

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

        if (doc && doc.contentUrl && !doc.contentUrl.startsWith('http')) {
            try {
                const fs = require('fs');
                if (fs.existsSync(doc.contentUrl)) fs.unlinkSync(doc.contentUrl);
            } catch (error) {
                this.logger.error(`Erro ao remover arquivo físico: ${error.message}`);
            }
        }

        return (this.prisma as any).document.deleteMany({
            where: {
                id: documentId,
                knowledgeBase: { companyId }
            }
        });
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
        const validLanguages = ['pt-BR', 'en-US', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'zh-CN'];

        if (!validLanguages.includes(language)) {
            throw new BadRequestException(`Idioma inválido. Use: ${validLanguages.join(', ')}`);
        }

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
