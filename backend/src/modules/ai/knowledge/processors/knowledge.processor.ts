import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../../database/prisma.service';
import { VectorStoreService } from '../../engine/vector-store.service';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import axios from 'axios';
import * as pdf from 'pdf-parse';
import * as mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';

@Processor('knowledge-processing')
export class KnowledgeProcessor extends WorkerHost {
    private readonly logger = new Logger(KnowledgeProcessor.name);

    constructor(
        private prisma: PrismaService,
        private vectorStore: VectorStoreService,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const { documentId, companyId } = job.data;
        this.logger.log(`Iniciando processamento do documento: ${documentId}`);

        try {
            // 1. Busca o documento
            const document = await (this.prisma as any).document.findUnique({
                where: { id: documentId },
            });

            if (!document) throw new Error('Documento não encontrado');

            // 2. Atualiza status para PROCESSING
            await (this.prisma as any).document.update({
                where: { id: documentId },
                data: { status: 'PROCESSING' },
            });

            // 3. Extrai o conteúdo baseado no sourceType
            let text = '';

            if (document.sourceType === 'TEXT') {
                text = document.rawContent;
            } else if (document.sourceType === 'PDF' && document.contentUrl) {
                const buffer = await this.getContentBuffer(document.contentUrl);
                const pdfData = await (pdf as any)(buffer);
                text = pdfData.text;
            } else if (document.sourceType === 'DOCX' && document.contentUrl) {
                const buffer = await this.getContentBuffer(document.contentUrl);
                const docxResult = await mammoth.extractRawText({ buffer });
                text = docxResult.value;
            } else if (document.sourceType === 'URL' && document.contentUrl) {
                const response = await axios.get(document.contentUrl);
                // Limpeza básica de HTML
                text = response.data
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                    .replace(/<[^>]*>?/gm, ' ')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
            }

            if (!text) throw new Error('Falha ao extrair texto do documento');

            // 4. Chunking (Divisão em pedaços)
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });

            const chunks = await splitter.splitText(text);

            // 5. Gera Embeddings e Salva Chunks (com queries parametrizadas)
            let chunkCount = 0;
            for (const content of chunks) {
                const embedding = await this.vectorStore.generateEmbedding(content);
                const vectorString = `[${embedding.join(',')}]`;

                // Query parametrizada para evitar SQL Injection
                await (this.prisma as any).$executeRaw`
                    INSERT INTO document_chunks (id, "documentId", content, embedding)
                    VALUES (gen_random_uuid(), ${documentId}, ${content}, ${vectorString}::vector);
                `;
                chunkCount++;
            }

            // 6. Finaliza documento
            await (this.prisma as any).document.update({
                where: { id: documentId },
                data: {
                    status: 'READY',
                    chunkCount,
                    rawContent: text
                },
            });

            this.logger.log(`Documento ${documentId} processado com sucesso: ${chunkCount} chunks.`);
            return { success: true, chunkCount };

        } catch (error) {
            this.logger.error(`Erro ao processar documento ${documentId}: ${error.message}`);

            await (this.prisma as any).document.update({
                where: { id: documentId },
                data: { status: 'ERROR' },
            });

            throw error;
        }
    }

    /**
     * Auxiliar para obter buffer de conteúdo (suporta URL externa ou path local)
     */
    private async getContentBuffer(contentUrl: string): Promise<Buffer> {
        if (contentUrl.startsWith('http')) {
            const response = await axios.get(contentUrl, { responseType: 'arraybuffer' });
            return Buffer.from(response.data);
        } else {
            // Assume path local (gerado pelo novo sistema de upload)
            if (fs.existsSync(contentUrl)) {
                return fs.readFileSync(contentUrl);
            }
            throw new Error(`Arquivo não encontrado no path: ${contentUrl}`);
        }
    }
}
