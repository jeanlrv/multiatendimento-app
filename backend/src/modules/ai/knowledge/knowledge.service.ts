import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge.dto';
import { AddDocumentDto } from './dto/add-document.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class KnowledgeService {
    private readonly logger = new Logger(KnowledgeService.name);
    private readonly storageBasePath: string;

    constructor(
        private prisma: PrismaService,
        @InjectQueue('knowledge-processing') private knowledgeQueue: Queue,
        private eventEmitter: EventEmitter2,
    ) {
        // Configurar caminho base de armazenamento local
        this.storageBasePath = process.env.STORAGE_PATH
            ? path.resolve(process.env.STORAGE_PATH)
            : path.join(process.cwd(), 'storage', 'uploads');

        // Garantir que o diretório exista
        if (!fs.existsSync(this.storageBasePath)) {
            fs.mkdirSync(this.storageBasePath, { recursive: true });
            this.logger.log(`Diretório de storage criado: ${this.storageBasePath}`);
        }
    }

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
                    orderBy: { createdAt: 'desc' },
                    include: {
                        _count: {
                            select: {
                                chunks: true
                            }
                        }
                    }
                }
            }
        });

        if (!base) throw new NotFoundException('Base de conhecimento não encontrada');

        // Adiciona flag isVectorized para o frontend de forma amigável
        const docsWithFlags = base.documents.map((doc: any) => ({
            ...doc,
            vectorizedCount: doc._count?.chunks || 0,
            isVectorized: (doc._count?.chunks || 0) > 0 && doc.status === 'READY'
        }));

        return { ...base, documents: docsWithFlags };
    }

    async removeBase(companyId: string, id: string) {
        // 1. Buscar todos os documentos desta base para limpar arquivos físicos
        const docs = await (this.prisma as any).document.findMany({
            where: { knowledgeBaseId: id, knowledgeBase: { companyId } },
            select: { id: true }
        });

        // 2. Remover cada documento individualmente (faz cleanup de chunks e arquivos)
        for (const doc of docs) {
            await this.removeDocument(companyId, doc.id);
        }

        // 3. Remover a base
        const deleted = await (this.prisma as any).knowledgeBase.deleteMany({
            where: { id, companyId }
        });

        // 4. Invalidação final de cache para a base
        this.emitKnowledgeUpdated(id, companyId);

        return deleted;
    }

    async addDocument(companyId: string, baseId: string, data: AddDocumentDto) {
        // Validação leve
        const base = await (this.prisma as any).knowledgeBase.findFirst({
            where: { id: baseId, companyId },
            select: { id: true }
        });
        if (!base) throw new NotFoundException('Base de conhecimento não encontrada');

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

    /**
     * Adiciona documento a partir de upload de arquivo.
     * ARMAZENAMENTO 100% LOCAL - Sem S3
     */
    async addDocumentFromFile(
        companyId: string,
        baseId: string,
        file: Express.Multer.File,
        title?: string
    ) {
        // Validar base de conhecimento
        const base = await (this.prisma as any).knowledgeBase.findFirst({
            where: { id: baseId, companyId },
            select: { id: true, embeddingProvider: true, embeddingModel: true }
        });
        if (!base) throw new NotFoundException('Base de conhecimento não encontrada');

        // Validar arquivo
        const validation = this.validateFile(file);
        if (!validation.valid) {
            throw new BadRequestException(validation.error);
        }

        const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
        const sourceType = detectSourceType(ext);
        const contentType = getMimeType(ext);

        // Gerar ID do documento antecipadamente para organizar storage
        const documentId = randomUUID();

        // Criar caminho de armazenamento: storage/uploads/{companyId}/{baseId}/{documentId}/
        const storageDir = path.join(this.storageBasePath, companyId, base.id, documentId);
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
        }

        // Gerar nome de arquivo seguro
        const safeFilename = `${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const localPath = path.join(storageDir, safeFilename);

        // Salvar arquivo localmente
        let contentUrl: string | null = null;
        let rawContent: string | null = null;

        // Tipos binários que exigem armazenamento como arquivo
        const BINARY_SOURCE_TYPES = new Set(['PDF', 'DOCX', 'XLSX', 'XLS', 'PPTX', 'EPUB', 'AUDIO', 'MP3', 'WAV', 'MP4', 'OGG', 'WEBM', 'M4A']);
        const isBinaryType = BINARY_SOURCE_TYPES.has(sourceType.toUpperCase());

        try {
            if (isBinaryType) {
                // Arquivos binários: salvar como arquivo físico
                if (file.buffer && file.buffer.length > 0) {
                    fs.writeFileSync(localPath, file.buffer);
                    this.logger.log(`Arquivo binário salvo: ${localPath} (${file.buffer.length} bytes)`);
                } else if (file.path) {
                    fs.copyFileSync(file.path, localPath);
                    this.logger.log(`Arquivo binário copiado para storage local: ${localPath}`);
                } else {
                    throw new Error('Arquivo sem conteúdo disponível para salvar');
                }
                contentUrl = localPath;
            } else {
                // Arquivos de texto: ler conteúdo para rawContent (mais eficiente)
                // Mas também manter cópia física se necessário
                if (file.buffer && file.buffer.length > 0) {
                    // Tentar decodificar como UTF-8
                    try {
                        rawContent = file.buffer.toString('utf-8').replace(/\0/g, '').substring(0, 500000);
                        this.logger.log(`Conteúdo de texto lido do buffer: ${file.originalname}`);
                    } catch (decodeErr) {
                        // Fallback: tentar latin1 (ISO-8859-1)
                        rawContent = file.buffer.toString('latin1').replace(/\0/g, '').substring(0, 500000);
                        this.logger.log(`Conteúdo de texto lido (latin1 fallback): ${file.originalname}`);
                    }
                    // Salvar cópia física também
                    fs.writeFileSync(localPath, file.buffer);
                    contentUrl = localPath;
                } else if (file.path) {
                    const MAX_READ_BYTES = 500000;
                    const stat = fs.statSync(file.path);
                    const bytesToRead = Math.min(stat.size, MAX_READ_BYTES);
                    const buffer = Buffer.alloc(bytesToRead);
                    const fd = fs.openSync(file.path, 'r');
                    fs.readSync(fd, buffer, 0, bytesToRead, 0);
                    fs.closeSync(fd);
                    rawContent = buffer.toString('utf-8').replace(/\0/g, '');
                    this.logger.log(`Conteúdo de texto lido do disco: ${file.path}`);

                    // Copiar para storage organizado
                    fs.copyFileSync(file.path, localPath);
                    contentUrl = localPath;

                    // Limpar arquivo temporário original
                    try {
                        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                    } catch { /* ignore */ }
                }
            }
        } catch (saveErr) {
            this.logger.error(`Falha ao salvar arquivo: ${saveErr.message}`);
            throw new BadRequestException(`Não foi possível salvar o arquivo: ${saveErr.message}`);
        }

        // Criar documento no banco
        const document = await (this.prisma as any).document.create({
            data: {
                title: title || file.originalname,
                sourceType,
                contentUrl,
                rawContent,
                knowledgeBaseId: baseId,
                status: 'PENDING',
            },
        });

        this.logger.log(`Documento criado: ${document.id}, tipo: ${sourceType}, path: ${contentUrl}`);

        // Enviar para fila de processamento
        await this.enqueueProcessing(document.id, companyId);
        this.emitKnowledgeUpdated(baseId, companyId);

        return document;
    }

    /**
     * Valida arquivo enviado
     */
    private validateFile(file: Express.Multer.File): { valid: boolean; error?: string } {
        if (!file) {
            return { valid: false, error: 'Nenhum arquivo enviado' };
        }

        // Validar tamanho máximo (50MB)
        const MAX_FILE_SIZE = 50 * 1024 * 1024;
        const fileSize = file.size || (file.buffer?.length) || 0;
        if (fileSize > MAX_FILE_SIZE) {
            return { valid: false, error: `Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB` };
        }

        // Validar extensão permitida
        const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
        const ALLOWED_EXTS = new Set([
            'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'epub',
            'txt', 'md', 'mdx', 'markdown', 'rtf',
            'html', 'htm',
            'csv', 'json', 'yaml', 'yml', 'xml',
            'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'go', 'rb', 'php', 'cs', 'cpp', 'c', 'rs', 'swift', 'kt', 'sh', 'bash', 'sql',
            'mp3', 'wav', 'mp4', 'ogg', 'webm', 'm4a', 'mpeg'
        ]);
        if (!ALLOWED_EXTS.has(ext)) {
            return { valid: false, error: `Extensão não suportada: .${ext}` };
        }

        return { valid: true };
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
            include: {
                _count: {
                    select: {
                        chunks: true
                    }
                }
            }
        });

        if (!doc) throw new NotFoundException('Documento não encontrado');

        return {
            id: doc.id,
            status: doc.status,
            chunkCount: doc.chunkCount,
            vectorizedCount: doc._count?.chunks || 0,
            isVectorized: (doc._count?.chunks || 0) > 0 && doc.status === 'READY',
            error: (doc as any).error
        };
    }

    async removeDocument(companyId: string, documentId: string) {
        const doc = await (this.prisma as any).document.findFirst({
            where: { id: documentId, knowledgeBase: { companyId } }
        });

        if (!doc) return { count: 0 };

        // Deletar chunks primeiro
        await (this.prisma as any).documentChunk.deleteMany({
            where: { documentId }
        });

        // Remover arquivo físico se existir
        if (doc.contentUrl) {
            try {
                if (fs.existsSync(doc.contentUrl)) {
                    fs.unlinkSync(doc.contentUrl);
                    this.logger.log(`Arquivo removido: ${doc.contentUrl}`);

                    // Tentar remover diretório pai se vazio
                    const parentDir = path.dirname(doc.contentUrl);
                    try {
                        const files = fs.readdirSync(parentDir);
                        if (files.length === 0) {
                            fs.rmdirSync(parentDir);
                            this.logger.log(`Diretório removido: ${parentDir}`);
                        }
                    } catch { /* ignore se não estiver vazio */ }
                }
            } catch (error) {
                this.logger.error(`Erro ao remover arquivo físico: ${error.message}`);
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
            if (doc.contentUrl) {
                try {
                    if (fs.existsSync(doc.contentUrl)) {
                        fs.unlinkSync(doc.contentUrl);
                    }
                } catch (error) {
                    this.logger.error(`Erro ao remover arquivo físico (${doc.id}): ${error.message}`);
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
        if (!doc.contentUrl && !doc.rawContent) {
            throw new BadRequestException('Documento não possui arquivo físico ou texto extraído para download');
        }

        return doc;
    }

    async createBulkDownloadZip(companyId: string, documentIds: string[]) {
        const docs = await (this.prisma as any).document.findMany({
            where: {
                id: { in: documentIds },
                knowledgeBase: { companyId }
            }
        });

        if (docs.length === 0) throw new BadRequestException('Nenhum documento encontrado');

        const JSZip = require('jszip');
        const zip = new JSZip();

        for (const doc of docs) {
            try {
                let fileData: Buffer | null = null;
                let fileName = doc.title;

                if (doc.contentUrl) {
                    if (fs.existsSync(doc.contentUrl)) {
                        fileData = fs.readFileSync(doc.contentUrl);
                    }
                } else if (doc.rawContent) {
                    fileData = Buffer.from(doc.rawContent, 'utf-8');
                    fileName = `${doc.title}.txt`;
                }

                if (fileData) {
                    zip.file(fileName, fileData);
                }
            } catch (error) {
                this.logger.error(`Erro ao adicionar arquivo ${doc.title} ao ZIP: ${error.message}`);
            }
        }

        return zip.generateAsync({ type: 'nodebuffer' });
    }

    /**
     * Reprocessa TODOS os documentos de uma base de conhecimento.
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

        // 1. Apaga todos os chunks da base
        await (this.prisma as any).documentChunk.deleteMany({
            where: { documentId: { in: docIds } },
        });

        // 2. Marca todos os documentos como PENDING
        await (this.prisma as any).document.updateMany({
            where: { id: { in: docIds } },
            data: { status: 'PENDING' },
        });

        // 3. Enfileira todos em paralelo
        await Promise.all(docIds.map((id: string) => this.enqueueProcessing(id, companyId)));

        this.emitKnowledgeUpdated(knowledgeBaseId, companyId);
        return { message: `${docIds.length} documento(s) enviado(s) para reprocessamento`, count: docIds.length };
    }

    async reprocessDocument(companyId: string, documentId: string) {
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

    async updateBase(companyId: string, id: string, data: { name?: string; description?: string; language?: string; embeddingProvider?: string; embeddingModel?: string }) {
        const base = await this.findOneBase(companyId, id);

        if (data.name && data.name.length < 2) {
            throw new BadRequestException('Nome deve ter pelo menos 2 caracteres');
        }
        if (data.name && data.name.length > 100) {
            throw new BadRequestException('Nome não pode exceder 100 caracteres');
        }

        // Extrai apenas os campos permitidos para evitar que campos extras do cliente
        // (id, companyId, createdAt, _count…) sejam passados ao Prisma e causem erro.
        const { name, description, language, embeddingProvider, embeddingModel } = data;
        const updateData: Record<string, any> = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (language !== undefined) updateData.language = language;
        if (embeddingProvider !== undefined) updateData.embeddingProvider = embeddingProvider;
        if (embeddingModel !== undefined) updateData.embeddingModel = embeddingModel;

        const updated = await (this.prisma as any).knowledgeBase.update({
            where: { id },
            data: updateData
        });

        this.emitKnowledgeUpdated(id, companyId);
        return updated;
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

        const documentsByStatus = await (this.prisma as any).document.groupBy({
            by: ['status'],
            where: { knowledgeBaseId: id },
            _count: true
        });

        const totalChunks = await (this.prisma as any).documentChunk.aggregate({
            where: { document: { knowledgeBaseId: id } },
            _count: true
        });

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
    md: 'TXT',
    mdx: 'TXT',
    markdown: 'TXT',
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
    js: 'CODE',
    ts: 'CODE',
    jsx: 'CODE',
    tsx: 'CODE',
    py: 'CODE',
    java: 'CODE',
    go: 'CODE',
    rb: 'CODE',
    php: 'CODE',
    cs: 'CODE',
    cpp: 'CODE',
    c: 'CODE',
    rs: 'CODE',
    swift: 'CODE',
    kt: 'CODE',
    sh: 'CODE',
    bash: 'CODE',
    sql: 'CODE',
    
    // Áudio/Vídeo
    mp3: 'AUDIO',
    wav: 'AUDIO',
    mp4: 'AUDIO',
    ogg: 'AUDIO',
    webm: 'AUDIO',
    m4a: 'AUDIO',
    mpeg: 'AUDIO',
    mov: 'AUDIO',
    flac: 'AUDIO',
    aac: 'AUDIO',
    wma: 'AUDIO',
    alac: 'AUDIO'
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
    return EXT_TO_SOURCE_TYPE[ext.toLowerCase()] || 'TXT';
}

export function getMimeType(ext: string): string {
    return EXT_TO_MIME[ext.toLowerCase()] || 'application/octet-stream';
}