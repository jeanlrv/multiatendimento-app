import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../../database/prisma.service';
import { VectorStoreService } from '../../engine/vector-store.service';
import { ProviderConfigService } from '../../../settings/provider-config.service';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import * as fs from 'fs';

@Processor('knowledge-processing', { concurrency: 1 })
export class KnowledgeProcessor extends WorkerHost {
    private readonly logger = new Logger(KnowledgeProcessor.name);

    constructor(
        private prisma: PrismaService,
        private vectorStore: VectorStoreService,
        private providerConfigService: ProviderConfigService,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const { documentId, companyId } = job.data;
        this.logger.log(`[Processador] Iniciando processamento do documento: ${documentId}`);

        try {
            // 1. Busca o documento e a base de conhecimento
            const document = await this.prisma.document.findUnique({
                where: { id: documentId },
                include: { knowledgeBase: true },
            });

            if (!document) throw new Error('Documento não encontrado');

            // 2. Atualiza status para PROCESSING
            await this.prisma.document.update({
                where: { id: documentId },
                data: { status: 'PROCESSING' },
            });

            // 3. Extrai o conteúdo baseado no sourceType
            this.logger.log(`[Processador] Extraindo texto do documento ${documentId} (tipo: ${document.sourceType})`);
            const extractResult = await this.extractTextWithMetadata(document);

            const { text, pageCount } = extractResult;

            if (!text || text.trim().length === 0) {
                throw new Error('Falha ao extrair texto do documento ou documento vazio');
            }

            this.logger.log(`[Processador] Texto extraído com sucesso: ${text.length} caracteres${pageCount ? `, ${pageCount} páginas` : ''}`);

            // 4. Chunking adaptativo — documentos longos usam chunks maiores
            const isLongDoc = text.length > 50000;
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: isLongDoc ? 2000 : 1500,
                chunkOverlap: 400,   // Aumentado de 300 → 400 para melhor coerência semântica
            });
            const chunks = await splitter.splitText(text);
            this.logger.log(`[Processador] Documento ${documentId} dividido em ${chunks.length} chunks (tamanho: ${isLongDoc ? 2000 : 1500}, overlap: 400)`);

            // 5. Gera embeddings usando o provider da base de conhecimento
            let embeddingProvider = document.knowledgeBase?.embeddingProvider || 'native';
            let embeddingModel = document.knowledgeBase?.embeddingModel || 'all-MiniLM-L6-v2';

            // Busca API key da empresa para o provider de embedding configurado
            let embeddingApiKey: string | undefined;
            let embeddingBaseUrl: string | undefined;
            try {
                const providerConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
                const providerConfig = providerConfigs.get(embeddingProvider);
                embeddingApiKey = providerConfig?.apiKey ?? undefined;
                embeddingBaseUrl = providerConfig?.baseUrl ?? undefined;
            } catch (cfgErr) {
                this.logger.warn(`[Processador] Não foi possível carregar configs do provider ${embeddingProvider}: ${cfgErr.message}`);
            }

            this.logger.log(`[Processador] Documento ${documentId} — provider: ${embeddingProvider}, model: ${embeddingModel ?? 'default'}, apiKey: ${embeddingApiKey ? 'configurada' : 'não encontrada'}`);

            const BATCH_SIZE = 50;
            let processedCount = 0;
            const chunkCount = chunks.length;
            let embeddingFailed = false;
            let embeddingFailReason = '';

            for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
                const batchChunks = chunks.slice(i, i + BATCH_SIZE);
                const chunkData: { documentId: string; content: string; embedding?: any; metadata?: any }[] = [];

                for (let j = 0; j < batchChunks.length; j++) {
                    const content = batchChunks[j];
                    let embedding: number[] | null = null;

                    if (!embeddingFailed) {
                        try {
                            embedding = await this.vectorStore.generateEmbedding(
                                content, embeddingProvider, embeddingModel, embeddingApiKey, embeddingBaseUrl
                            );
                        } catch (embErr: any) {
                            // Tolerância a falha: salva chunk sem embedding
                            embeddingFailed = true;
                            embeddingFailReason = embErr.message;
                            this.logger.warn(
                                `[Processador] Falha ao gerar embedding com provider '${embeddingProvider}'. ` +
                                `Documento será salvo SEM vetorização (apenas FTS). Erro: ${embErr.message}`
                            );
                        }
                    }

                    // Metadata do chunk: índice global, nome do documento e, se disponível, info de página
                    const chunkIndex = i + j;
                    const metadata: any = {
                        chunkIndex,
                        documentName: document.title || '',
                        documentId,
                    };
                    if (pageCount && pageCount > 0) {
                        // Estima página baseada no índice relativo do chunk
                        const estimatedPage = Math.ceil(((chunkIndex + 1) / chunkCount) * pageCount);
                        metadata.estimatedPage = estimatedPage;
                        metadata.totalPages = pageCount;
                    }

                    chunkData.push({
                        documentId,
                        content,
                        embedding: embedding && embedding.length > 0 ? (embedding as any) : undefined,
                        metadata,
                    });
                }

                // Insere lote atual no banco
                if (chunkData.length > 0) {
                    await this.prisma.documentChunk.createMany({ data: chunkData });
                    processedCount += chunkData.length;
                    this.logger.log(`Documento ${documentId} - lote inserido: ${processedCount}/${chunkCount} chunks.`);
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }

            // 6. Finaliza documento
            await this.prisma.document.update({
                where: { id: documentId },
                data: {
                    status: 'READY',
                    chunkCount,
                    rawContent: text.substring(0, 100000),
                },
            });

            // 7. Invalida cache RAG da KB para forçar re-carregamento dos chunks na próxima query
            this.vectorStore.invalidateRagCache(document.knowledgeBaseId, companyId);

            if (embeddingFailed) {
                this.logger.warn(`Documento ${documentId} salvo como READY sem embeddings (apenas FTS). Razão: ${embeddingFailReason}`);
            } else {
                this.logger.log(`Documento ${documentId} processado com sucesso: ${chunkCount} chunks (provider: ${embeddingProvider}).`);
            }
            return { success: true, chunkCount, embeddingFailed };

        } catch (error: any) {
            this.logger.error(`[Processador] Erro ao processar documento ${documentId}: ${error.message}`, error.stack);
            await this.prisma.document.update({
                where: { id: documentId },
                data: {
                    status: 'ERROR',
                    rawContent: `ERRO: ${error.message?.substring(0, 900) || 'Erro desconhecido'}\n\nVerifique o tipo do arquivo e se ele está corrompido.`
                },
            });

            // Erros permanentes (nunca se resolvem com retry) → não relança para evitar
            // loop infinito de retentativas no BullMQ. BullMQ marca o job como "completed".
            const permanentErrorPatterns = [
                'escaneado',
                'sem camada de texto',
                'senha',
                'password',
                'encrypted',
                'DRM',
                'corrompido',
                'inválid',
                'não suportado',
                'Documento não encontrado',
            ];
            const isPermanent = permanentErrorPatterns.some(p => error.message?.toLowerCase().includes(p.toLowerCase()));
            if (isPermanent) {
                this.logger.warn(`[Processador] Erro permanente — não reenfileirando: ${error.message}`);
                return { success: false, error: error.message };
            }

            throw error; // erros transitórios (rede, timeout) → BullMQ pode reintentar
        }
    }

    /**
     * Extrai texto de um documento baseado no sourceType.
     * Retorna texto + metadados (ex: número de páginas para PDF).
     * ARMAZENAMENTO 100% LOCAL - Sem S3
     */
    private async extractTextWithMetadata(document: any): Promise<{ text: string; pageCount?: number }> {
        const { sourceType, contentUrl, rawContent } = document;
        const type = sourceType?.toUpperCase();

        this.logger.log(`[ExtractText] Tipo: ${type}, contentUrl: ${contentUrl}, rawContent length: ${rawContent?.length || 0}`);

        switch (type) {
            // ── Texto puro ──────────────────────────────────────────────────────
            case 'TEXT':
            case 'TXT':
            case 'MD':
            case 'MARKDOWN':
            case 'CODE':
            case 'RTF':
                if (rawContent) return { text: rawContent };
                if (contentUrl) {
                    const buf = await this.getContentBuffer(contentUrl);
                    let text = buf.toString('utf-8');
                    // Para RTF: remover control codes
                    if (type === 'RTF') text = text.replace(/\\[a-z]+\d*\s?|[{}]|[^a-zA-Z0-9\s\.,;:!?'"()\-]/g, ' ').replace(/\s+/g, ' ').trim();
                    return { text };
                }
                return { text: '' };

            // ── Dados estruturados ───────────────────────────────────────────────
            case 'JSON':
                if (rawContent) return { text: rawContent };
                if (contentUrl) {
                    const buf = await this.getContentBuffer(contentUrl);
                    try {
                        const parsed = JSON.parse(buf.toString('utf-8'));
                        return { text: JSON.stringify(parsed, null, 2) };
                    } catch {
                        return { text: buf.toString('utf-8') };
                    }
                }
                return { text: '' };

            case 'YAML':
            case 'YML': {
                const src = rawContent || (contentUrl ? (await this.getContentBuffer(contentUrl)).toString('utf-8') : '');
                try {
                    const yaml = require('yaml');
                    const parsed = yaml.parse(src);
                    return { text: JSON.stringify(parsed, null, 2) };
                } catch {
                    return { text: src };
                }
            }

            case 'XML': {
                const src = rawContent || (contentUrl ? (await this.getContentBuffer(contentUrl)).toString('utf-8') : '');
                // Extrai pares tag:valor para preservar contexto semântico (ideal para NFe/CTe/MDFe)
                const text = this.extractXmlLeafPairs(src);
                return { text: text || '[XML sem conteúdo extraível]' };
            }

            case 'XSD': {
                const src = rawContent || (contentUrl ? (await this.getContentBuffer(contentUrl)).toString('utf-8') : '');
                // Extrai dicionário de elementos do schema (ideal para schemas fiscais brasileiros)
                const text = this.extractXsdSummary(src);
                return { text: text || '[XSD sem elementos encontrados]' };
            }

            case 'CSV': {
                const src = rawContent || (contentUrl ? (await this.getContentBuffer(contentUrl)).toString('utf-8') : '');
                // Parsear CSV com suporte a campos entre aspas
                const parseCsvLine = (line: string): string[] => {
                    const result: string[] = [];
                    let current = '';
                    let inQuotes = false;
                    for (let i = 0; i < line.length; i++) {
                        const ch = line[i];
                        if (ch === '"') { inQuotes = !inQuotes; }
                        else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
                        else { current += ch; }
                    }
                    result.push(current.trim());
                    return result;
                };
                const lines = src.split('\n').map(l => l.trim()).filter(l => l);
                if (lines.length === 0) return { text: '' };
                const headers = parseCsvLine(lines[0]);
                const rows = lines.slice(1).map(line => {
                    const vals = parseCsvLine(line);
                    // Formato semântico: "Coluna: Valor | Coluna: Valor" (mesmo padrão do XLSX)
                    return headers.map((h, i) => `${h}: ${vals[i] ?? ''}`).join(' | ');
                }).filter(r => r.replace(/[|:\s]/g, ''));
                return { text: `${headers.join(', ')}\n\n${rows.join('\n')}` };
            }

            // ── PDF ───────────────────────────────────────────────────────────────
            case 'PDF': {
                if (!contentUrl) throw new Error('PDF requer contentUrl (arquivo local)');

                if (!fs.existsSync(contentUrl)) {
                    throw new Error(`Arquivo PDF não encontrado: ${contentUrl}`);
                }

                const buffer = await this.getContentBuffer(contentUrl);

                // pdf-parse@1.1.1: exporta diretamente uma função async (buffer, options) => data
                let pdfParse: Function;
                try {
                    pdfParse = require('pdf-parse');
                    // Garante que é uma função (compatibilidade com eventuais ambientes)
                    if (typeof pdfParse !== 'function') {
                        // Tenta o .default para bundlers que empacotam ESM
                        if (typeof (pdfParse as any).default === 'function') {
                            pdfParse = (pdfParse as any).default;
                        } else {
                            throw new Error('pdf-parse não exportou uma função. Verifique se a versão 1.1.1 está instalada (npm install pdf-parse@1.1.1).');
                        }
                    }
                } catch (loadErr: any) {
                    throw new Error(`Falha ao carregar pdf-parse: ${loadErr.message}`);
                }

                try {
                    const pdfData = await pdfParse(buffer, {
                        // Opções para melhorar extração
                        normalizeWhitespace: true,
                    });

                    if (!pdfData.text || pdfData.text.trim().length === 0) {
                        // PDF escaneado — sem camada de texto extraível por pdf-parse.
                        // Fallback: usar rawContent (descrição fornecida pelo usuário) se disponível.
                        const fallbackText = rawContent && rawContent.trim().length > 20
                            ? rawContent.trim()
                            : null;

                        if (fallbackText) {
                            this.logger.warn(`[PDF] PDF escaneado — sem texto nativo. Usando rawContent como fallback (${fallbackText.length} chars): ${contentUrl}`);
                            return { text: fallbackText, pageCount: pdfData.numpages };
                        }

                        // Sem fallback: cria um chunk mínimo com metadado do arquivo
                        const filename = contentUrl?.split('/').pop() || 'documento.pdf';
                        const minimalText = `[Documento sem texto extraível]\nArquivo: ${filename}\nObservação: Este PDF contém apenas imagens (PDF escaneado). Para ter o conteúdo indexado, converta o PDF para texto via OCR antes de enviar.`;
                        this.logger.warn(`[PDF] PDF escaneado — criando chunk de metadado mínimo: ${filename}`);
                        return { text: minimalText, pageCount: pdfData.numpages };
                    }

                    // Limpeza pós-extração do PDF
                    const cleanedText = this.cleanPdfText(pdfData.text);

                    this.logger.log(`[PDF] Texto extraído: ${cleanedText.length} caracteres, ${pdfData.numpages || '?'} páginas`);
                    return { text: cleanedText, pageCount: pdfData.numpages };
                } catch (parseErr: any) {
                    if (parseErr.message.includes('password') || parseErr.message.includes('encrypted') || parseErr.message.includes('crypt')) {
                        throw new Error('PDF está protegido por senha. Remova a proteção antes de enviar.');
                    }
                    throw parseErr;
                }
            }

            // ── DOCX ─────────────────────────────────────────────────────────────
            case 'DOCX': {
                if (!contentUrl) throw new Error('DOCX requer contentUrl');

                if (!fs.existsSync(contentUrl)) {
                    throw new Error(`Arquivo DOCX não encontrado: ${contentUrl}`);
                }

                const buffer = await this.getContentBuffer(contentUrl);
                const mammoth = require('mammoth');

                try {
                    const result = await mammoth.extractRawText({ buffer });
                    if (!result.value || result.value.trim().length === 0) {
                        this.logger.warn('[DOCX] Arquivo parece estar vazio ou conter apenas imagens');
                    }
                    // Normaliza parágrafos: garante linhas em branco entre parágrafos
                    const cleanText = (result.value || '')
                        .replace(/\r\n/g, '\n')
                        .replace(/\n{3,}/g, '\n\n')
                        .trim();
                    return { text: cleanText };
                } catch (extractErr: any) {
                    throw new Error(`Falha ao extrair texto do DOCX: ${extractErr.message}`);
                }
            }

            // ── XLSX / XLS ────────────────────────────────────────────────────────
            case 'XLSX':
            case 'XLS': {
                if (!contentUrl) throw new Error('XLSX/XLS requer contentUrl');

                if (!fs.existsSync(contentUrl)) {
                    throw new Error(`Arquivo ${type} não encontrado: ${contentUrl}`);
                }

                const buffer = await this.getContentBuffer(contentUrl);
                const XLSX = require('xlsx');

                try {
                    const workbook = XLSX.read(buffer, { type: 'buffer' });
                    const parts: string[] = [];

                    for (const sheetName of workbook.SheetNames) {
                        const sheet = workbook.Sheets[sheetName];
                        // Obtém dados como array de arrays para ter acesso ao cabeçalho
                        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                        if (!rows || rows.length === 0) continue;

                        const header = rows[0] as string[];
                        const dataRows = rows.slice(1).filter((row: any[]) => row.some((cell: any) => cell !== ''));

                        // Formatar cada linha como "Coluna: Valor, Coluna: Valor" para dar contexto ao LLM
                        const formattedRows = dataRows.map((row: any[]) =>
                            header.map((h: any, idx: number) => {
                                const val = row[idx] !== undefined && row[idx] !== '' ? String(row[idx]) : '-';
                                return `${h || `Col${idx + 1}`}: ${val}`;
                            }).join(' | ')
                        );

                        parts.push(`=== Planilha: ${sheetName} (${dataRows.length} linhas) ===`);
                        parts.push(`Colunas: ${header.join(', ')}`);
                        parts.push(formattedRows.join('\n'));
                    }

                    if (parts.length === 0) {
                        this.logger.warn('[XLSX] Arquivo não contém dados nas planilhas');
                    }

                    return { text: parts.join('\n\n') };
                } catch (readErr: any) {
                    throw new Error(`Falha ao ler planilha: ${readErr.message}`);
                }
            }

            // ── PPTX ─────────────────────────────────────────────────────────────
            case 'PPTX': {
                if (!contentUrl) throw new Error('PPTX requer contentUrl');

                if (!fs.existsSync(contentUrl)) {
                    throw new Error(`Arquivo PPTX não encontrado: ${contentUrl}`);
                }

                const buffer = await this.getContentBuffer(contentUrl);

                try {
                    const text = await this.extractPptxText(buffer);
                    if (!text || text.trim().length === 0) {
                        this.logger.warn('[PPTX] Arquivo parece conter apenas imagens');
                        return { text: '[PPTX sem texto extraível]' };
                    }
                    return { text };
                } catch (extractErr: any) {
                    throw new Error(`Falha ao extrair texto do PPTX: ${extractErr.message}`);
                }
            }

            // ── EPUB ─────────────────────────────────────────────────────────────
            case 'EPUB': {
                if (!contentUrl) throw new Error('EPUB requer contentUrl');

                if (!fs.existsSync(contentUrl)) {
                    throw new Error(`Arquivo EPUB não encontrado: ${contentUrl}`);
                }

                const buffer = await this.getContentBuffer(contentUrl);

                try {
                    const text = await this.extractEpubText(buffer);
                    if (!text || text.trim().length === 0) {
                        throw new Error('EPUB parece estar vazio ou protegido por DRM');
                    }
                    return { text };
                } catch (extractErr: any) {
                    if (extractErr.message.includes('DRM')) {
                        throw new Error('EPUB está protegido por DRM. Remova a proteção antes de enviar.');
                    }
                    throw extractErr;
                }
            }

            // ── HTML / Web ───────────────────────────────────────────────────────
            case 'HTML':
            case 'HTM': {
                const src = rawContent || (contentUrl ? (await this.getContentBuffer(contentUrl)).toString('utf-8') : '');
                return { text: this.extractHtmlText(src) };
            }

            case 'URL': {
                if (!contentUrl) throw new Error('URL requer contentUrl');
                const isYouTube = /youtube\.com\/watch|youtu\.be\//.test(contentUrl);
                const isGitHub = /github\.com\//.test(contentUrl);

                if (isYouTube) return { text: await this.extractYouTubeTranscript(contentUrl) };
                if (isGitHub) return { text: await this.extractGitHubContent(contentUrl) };

                const axios = require('axios');
                const response = await axios.get(contentUrl, { timeout: 30000 });
                return { text: this.extractHtmlText(response.data) };
            }

            case 'YOUTUBE': {
                const url = contentUrl || rawContent;
                if (!url) throw new Error('YOUTUBE requer URL no contentUrl');
                return { text: await this.extractYouTubeTranscript(url) };
            }

            case 'GITHUB': {
                const url = contentUrl || rawContent;
                if (!url) throw new Error('GITHUB requer URL do repositório no contentUrl');
                return { text: await this.extractGitHubContent(url) };
            }

            // ── Áudio (Whisper) ──────────────────────────────────────────────────
            case 'AUDIO':
            case 'MP3':
            case 'WAV':
            case 'MP4':
            case 'OGG':
            case 'WEBM':
            case 'M4A': {
                if (!contentUrl) throw new Error('AUDIO requer contentUrl');

                if (!fs.existsSync(contentUrl)) {
                    throw new Error(`Arquivo de áudio não encontrado: ${contentUrl}`);
                }

                return { text: await this.transcribeAudio(contentUrl, document.knowledgeBase?.companyId) };
            }

            default:
                // Tentativa genérica de ler como texto
                if (rawContent) return { text: rawContent };
                if (contentUrl) {
                    const buf = await this.getContentBuffer(contentUrl);
                    return { text: buf.toString('utf-8') };
                }
                throw new Error(`Tipo de documento não suportado: ${sourceType}`);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers de extração
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Limpa texto extraído de PDFs:
     * - Remove hifenizações indevidas no final de linha (ex: "infor-\nmação" → "informação")
     * - Normaliza espaços em branco excessivos
     * - Remove caracteres de controle indesejados
     */
    private cleanPdfText(text: string): string {
        return text
            // Juntar palavras hifenizadas no final de linha
            .replace(/(\w+)-\n(\w+)/g, '$1$2')
            // Normalizar quebras de linha: múltiplas linhas vazias → uma linha vazia
            .replace(/\n{3,}/g, '\n\n')
            // Remover espaços redundantes no início/fim de linhas
            .split('\n').map((line: string) => line.trimEnd()).join('\n')
            // Normalizar espaços múltiplos (exceto quebras de linha)
            .replace(/[ \t]{2,}/g, ' ')
            // Remover caracteres de controle (exceto \n e \t)
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            .trim();
    }

    /**
     * Extrai campos de XML de dados (NFe, CTe, MDFe, etc.) usando parser de pilha.
     *
     * Agrupa por container (seção), inclui path-prefix nos campos internos e
     * numera elementos repetidos (ex: [det], [det 2], [det 3]...).
     *
     * Saída esperada para uma NF-e:
     *   [ide]
     *   nNF: 123 | natOp: VENDA DE MERCADORIA
     *   [emit]
     *   CNPJ: 12345678000190 | xNome: Empresa A
     *   [dest]
     *   CNPJ: 98765432000190 | xNome: Cliente B
     *   [det]
     *   prod/xProd: PRODUTO A | prod/vProd: 250.00
     *   [det 2]
     *   prod/xProd: PRODUTO B | prod/vProd: 125.00
     */
    private extractXmlLeafPairs(xml: string): string {
        let src = xml
            .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
            .replace(/<\?xml[^>]*\?>/g, '')
            .replace(/<!--[\s\S]*?-->/g, '');

        const getLocal = (tag: string) => tag.includes(':') ? tag.split(':').pop()! : tag;
        const decode = (s: string) => s
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&apos;/g, "'");

        // Seções criadas nas profundidades 2 e 3.
        // Profundidade 2 → XML simples (root → section → leaf).
        // Profundidade 3 → NFe/CTe (NFe → infNFe → ide/emit/dest/det → ...).
        const SECTION_DEPTHS = new Set([2, 3]);

        const stack: string[] = [];
        const sibCount = new Map<string, number>(); // "parentTag:childTag" → ocorrências

        // Cada seção recebe linhas dos nós folha sob ela
        const sections: Array<{ label: string; lines: string[]; depth: number }> = [];
        // Índice em sections[] para a seção ativa em cada profundidade
        const activeSectionAtDepth = new Map<number, number>();
        let curSectionIdx = -1;

        const re = /<(\/?)(?:[A-Za-z_][\w.]*:)?([A-Za-z_][\w.]*)([^>]*)>|([^<]+)/g;
        let m: RegExpExecArray | null;

        while ((m = re.exec(src)) !== null) {
            if (m[4] !== undefined) {
                // ── Nó de texto ──────────────────────────────────────────────────
                const text = m[4].replace(/\s+/g, ' ').trim();
                if (!text || curSectionIdx < 0) continue;
                const val = decode(text);
                const curSec = sections[curSectionIdx];

                // Label: path dos ancestrais entre o elemento de seção e a folha
                // (excluindo o próprio elemento de seção e a folha em si), até 2 níveis.
                const pathAfterRoot = stack.slice(1);                     // pula root
                const leaf = pathAfterRoot[pathAfterRoot.length - 1];
                const ancestorsAfterSection = pathAfterRoot.slice(curSec.depth - 1, -1);
                const prefix = ancestorsAfterSection.slice(-2).join('/');
                curSec.lines.push(`${prefix ? prefix + '/' : ''}${leaf}: ${val}`);

            } else {
                // ── Tag de abertura ou fechamento ─────────────────────────────────
                const isClose = m[1] === '/';
                const name = getLocal(m[2]);
                const attrs = m[3].trim();
                const selfClose = attrs.endsWith('/');

                if (!isClose) {
                    const depth = stack.length + 1;
                    const parentTag = stack[stack.length - 1] ?? '_';
                    const sk = `${parentTag}:${name}`;
                    const idx = (sibCount.get(sk) || 0) + 1;
                    sibCount.set(sk, idx);

                    if (SECTION_DEPTHS.has(depth)) {
                        const label = idx > 1 ? `${name} ${idx}` : name;
                        curSectionIdx = sections.length;
                        sections.push({ label, lines: [], depth });
                        activeSectionAtDepth.set(depth, curSectionIdx);
                    }
                    if (!selfClose) stack.push(name);
                } else {
                    stack.pop();
                    // Restaura seção ativa: percorre do parentDepth até 1 buscando
                    // a seção mais próxima (cobre fechamento de tags não-seção em profundidade arbitrária)
                    const parentDepth = stack.length;
                    let found = -1;
                    for (let d = parentDepth; d >= 1; d--) {
                        const si = activeSectionAtDepth.get(d);
                        if (si !== undefined) { found = si; break; }
                    }
                    curSectionIdx = found;
                }
            }
        }

        // Monta saída agrupada, filtrando seções sem conteúdo
        const outputLines: string[] = [];
        for (const sec of sections) {
            if (!sec.lines.length) continue;
            outputLines.push(`\n[${sec.label}]`);
            const deduped: string[] = [];
            for (const l of sec.lines) {
                if (deduped[deduped.length - 1] !== l) deduped.push(l);
            }
            outputLines.push(...deduped);
        }

        const result = outputLines.join('\n').trim();
        // Fallback para XML muito plano sem seções detectáveis
        return result || src.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    /**
     * Extrai dicionário de elementos de um XSD (XML Schema Definition).
     * Ideal para schemas de documentos fiscais brasileiros (NFe, CTe, MDFe, NFCe, etc.).
     * Resultado: "nomeElemento: descrição (xs:documentation)" ou apenas "nomeElemento".
     */
    private extractXsdSummary(xsd: string): string {
        // Remove declaração XML e comentários
        const src = xsd
            .replace(/<\?xml[^>]*\?>/g, '')
            .replace(/<!--[\s\S]*?-->/g, '');

        // Mapeia nome → documentação
        const nameOrder: string[] = [];
        const nameToDoc = new Map<string, string>();

        // Coleta todos os nomes de xs:element / xsd:element
        const nameRe = /<xsd?:element\s[^>]*\bname="([^"]+)"/gi;
        let m: RegExpExecArray | null;
        while ((m = nameRe.exec(src)) !== null) {
            const name = m[1].trim();
            if (!nameToDoc.has(name)) {
                nameToDoc.set(name, '');
                nameOrder.push(name);
            }
        }

        // Associa xs:annotation/xs:documentation ao elemento mais próximo anterior
        const annotRe = /<xsd?:annotation>([\s\S]*?)<\/xsd?:annotation>/gi;
        while ((m = annotRe.exec(src)) !== null) {
            const annotContent = m[1];
            const docMatch = annotContent.match(/<xsd?:documentation[^>]*>([\s\S]*?)<\/xsd?:documentation>/i);
            if (!docMatch) continue;
            const doc = docMatch[1].replace(/\s+/g, ' ').trim();
            if (!doc) continue;

            // Elemento declarado logo antes desta anotação (janela de 600 chars)
            const before = src.substring(Math.max(0, m.index - 600), m.index);
            const prevElem = [...before.matchAll(/<xsd?:element\s[^>]*\bname="([^"]+)"/gi)].pop();
            if (prevElem) {
                const name = prevElem[1].trim();
                if (nameToDoc.has(name) && !nameToDoc.get(name)) {
                    nameToDoc.set(name, doc);
                }
            }
        }

        const lines: string[] = ['=== Schema XSD — Elementos ==='];
        for (const name of nameOrder) {
            const doc = nameToDoc.get(name);
            lines.push(doc ? `${name}: ${doc}` : name);
        }

        // Tipos simples / complexos nomeados
        const typeRe = /<xsd?:(?:simpleType|complexType)\s[^>]*\bname="([^"]+)"/gi;
        const types: string[] = [];
        while ((m = typeRe.exec(src)) !== null) types.push(m[1].trim());
        if (types.length > 0) {
            lines.push('\n=== Tipos Definidos ===');
            lines.push(types.join(', '));
        }

        // Enumerações (até 100 valores)
        const enumRe = /<xsd?:enumeration\s[^>]*\bvalue="([^"]+)"/gi;
        const enums: string[] = [];
        while ((m = enumRe.exec(src)) !== null) enums.push(m[1].trim());
        if (enums.length > 0 && enums.length <= 100) {
            lines.push('\n=== Valores Enumerados ===');
            lines.push(enums.join(', '));
        }

        return lines.join('\n');
    }

    /**
     * Extrai texto limpo de HTML usando cheerio.
     */
    private extractHtmlText(html: string): string {
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);

        // Remove blocos desnecessários
        $('script, style, nav, header, footer, aside, .ads, .advertisement, [aria-hidden="true"]').remove();

        // Preserva estrutura de headings e parágrafos
        $('h1, h2, h3, h4, h5, h6').each((_: number, el: any) => {
            $(el).prepend('\n\n## ');
            $(el).append('\n\n');
        });
        $('p, li, td, th, br').each((_: number, el: any) => {
            $(el).append('\n');
        });

        return $('body').text()
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]+/g, ' ')
            .trim();
    }

    /**
     * Extrai texto de arquivo PPTX (PowerPoint é um ZIP com XMLs internos).
     */
    private async extractPptxText(buffer: Buffer): Promise<string> {
        const JSZip = require('jszip');
        const zip = await JSZip.loadAsync(buffer);
        const slideTexts: string[] = [];

        // Slides ficam em ppt/slides/slide*.xml
        const slideFiles = Object.keys(zip.files).filter(
            name => name.match(/^ppt\/slides\/slide\d+\.xml$/)
        ).sort();

        for (const slideFile of slideFiles) {
            const xml = await zip.files[slideFile].async('text');
            // Extrai texto dos elementos <a:t> (texto de shapes)
            const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
            const text = matches
                .map((m: string) => m.replace(/<[^>]+>/g, '').trim())
                .filter((t: string) => t.length > 0)
                .join(' ');
            if (text) slideTexts.push(`[Slide ${slideTexts.length + 1}] ${text}`);
        }

        if (slideTexts.length === 0) {
            this.logger.warn('[PPTX] Nenhum texto encontrado nos slides');
        }

        return slideTexts.join('\n\n');
    }

    /**
     * Extrai texto de arquivo EPUB.
     */
    private async extractEpubText(buffer: Buffer): Promise<string> {
        const JSZip = require('jszip');
        const zip = await JSZip.loadAsync(buffer);
        const texts: string[] = [];

        // Encontrar arquivos HTML/XHTML no EPUB
        const htmlFiles = Object.keys(zip.files).filter(
            name => name.match(/\.(html|xhtml|htm)$/i) && !zip.files[name].dir
        );

        for (const htmlFile of htmlFiles) {
            const content = await zip.files[htmlFile].async('text');
            const text = this.extractHtmlText(content);
            if (text.trim()) texts.push(text);
        }

        if (texts.length === 0) {
            throw new Error('Nenhum texto encontrado no EPUB (pode estar protegido por DRM)');
        }

        return texts.join('\n\n---\n\n');
    }

    /**
     * Transcreve áudio via Whisper.
     *
     * Prioridade:
     * 1. WHISPER_BASE_URL → servidor local compatível com OpenAI (faster-whisper-api, LocalAI, etc.)
     * 2. OPENAI_API_KEY   → OpenAI Whisper API (cloud)
     *
     * Para transcrição 100% local (sem API key), configure um servidor Whisper:
     *   Docker: docker run -p 9000:9000 fedirz/faster-whisper-server:latest-cpu
     *   Railway: adicione serviço faster-whisper e configure WHISPER_BASE_URL=http://<host>:9000
     *   LocalAI: WHISPER_BASE_URL=http://localhost:8080/v1
     */
    private async transcribeAudio(audioUrl: string, companyId?: string): Promise<string> {
        // Resolve provider: prioridade company DB config → env vars
        let whisperBaseUrl: string | null = null;
        let openAiKey: string | null = process.env.OPENAI_API_KEY || null;

        if (companyId) {
            const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
            const localConfig = companyConfigs.get('whisper-local');
            if (localConfig?.baseUrl) whisperBaseUrl = localConfig.baseUrl;
            const openaiConfig = companyConfigs.get('openai');
            if (openaiConfig?.apiKey) openAiKey = openaiConfig.apiKey;
        }

        if (!whisperBaseUrl) whisperBaseUrl = process.env.WHISPER_BASE_URL || null;

        if (!whisperBaseUrl && !openAiKey) {
            throw new Error(
                'Transcrição de áudio requer OPENAI_API_KEY (OpenAI) ou WHISPER_BASE_URL/whisper-local config (servidor local). ' +
                'Para uso local: docker run -p 9000:9000 fedirz/faster-whisper-server:latest-cpu e configure WHISPER_BASE_URL=http://localhost:9000'
            );
        }

        this.logger.log(`Transcrevendo áudio via Whisper (${whisperBaseUrl ? 'LOCAL: ' + whisperBaseUrl : 'OpenAI API'}): ${audioUrl}`);

        const buffer = await this.getContentBuffer(audioUrl);
        const { OpenAI, toFile } = require('openai');

        const openai = new OpenAI({
            apiKey: openAiKey || 'local-no-key-required',
            ...(whisperBaseUrl ? { baseURL: whisperBaseUrl } : {}),
        });

        // Determinar extensão do arquivo
        const ext = audioUrl.split('.').pop()?.toLowerCase() || 'mp3';
        // faster-whisper-server usa ffmpeg → aceita todos os formatos abaixo
        // OpenAI API oficial aceita: mp3, mp4, mpeg, mpga, m4a, wav, webm
        // Formatos WhatsApp (opus, oga, amr, 3gp) são enviados como-estão para o servidor local;
        // se cair no fallback OpenAI API, serão renomeados para mp3 (ffmpeg já converte o conteúdo)
        const nativeWhisperExts = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg'];
        const localServerExts = [...nativeWhisperExts, 'opus', 'oga', 'aac', 'amr', '3gp', '3gpp', 'flac'];
        const supportedExts = whisperBaseUrl ? localServerExts : nativeWhisperExts;
        const finalExt = supportedExts.includes(ext) ? ext : 'mp3';

        const file = await toFile(buffer, `audio.${finalExt}`);

        // faster-whisper-server usa modelo configurado no servidor; OpenAI usa 'whisper-1'
        const model = process.env.WHISPER_MODEL || 'whisper-1';

        const transcription = await openai.audio.transcriptions.create({
            file,
            model,
            language: 'pt', // Preferência pelo português
            response_format: 'text',
        });

        const text = typeof transcription === 'string' ? transcription : (transcription as any).text;
        if (!text) throw new Error('Whisper não retornou transcrição');

        return `[Transcrição de áudio]\n\n${text}`;
    }

    /**
     * Extrai transcrição de vídeo do YouTube.
     */
    private async extractYouTubeTranscript(url: string): Promise<string> {
        this.logger.log(`Extraindo transcrição do YouTube: ${url}`);

        // Extrair videoId da URL
        const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (!match) throw new Error('URL do YouTube inválida. Use formato: https://youtube.com/watch?v=ID ou https://youtu.be/ID');
        const videoId = match[1];

        const { YoutubeTranscript } = require('youtube-transcript');
        let transcriptItems: any[] = [];

        // Tentar idiomas em ordem de preferência
        const langPriority = ['pt', 'pt-BR', 'en'];
        let lastError: Error | null = null;

        for (const lang of langPriority) {
            try {
                transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, { lang });
                if (transcriptItems?.length) break;
            } catch (err) {
                lastError = err;
            }
        }

        // Fallback sem preferência de idioma
        if (!transcriptItems?.length) {
            try {
                transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
            } catch (err) {
                lastError = err;
            }
        }

        if (!transcriptItems?.length) {
            const baseMsg = 'Este vídeo do YouTube não possui transcrição/legenda disponível';
            const hint = lastError?.message ? ` (${lastError.message})` : '';
            throw new Error(`${baseMsg}${hint}. Certifique-se de que o vídeo tem legendas automáticas ou manuais ativadas.`);
        }

        const text = transcriptItems.map((item: any) => item.text).join(' ');
        return `[Transcrição do YouTube: ${url}]\n\n${text}`;
    }

    /**
     * Extrai conteúdo de um repositório GitHub via API pública.
     */
    private async extractGitHubContent(url: string): Promise<string> {
        this.logger.log(`Extraindo conteúdo do GitHub: ${url}`);

        // Parsear URL: https://github.com/{owner}/{repo}[/tree/{branch}[/path]]
        const match = url.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)(.*))?/);
        if (!match) throw new Error('URL do GitHub inválida. Use: https://github.com/owner/repo');

        const [, owner, repo, branch = 'HEAD', subPath = ''] = match;
        const cleanPath = subPath.replace(/^\//, '');

        const TEXT_EXTENSIONS = /\.(md|mdx|txt|rst|csv|json|yaml|yml|xml|html|htm|js|ts|jsx|tsx|py|java|go|rb|php|cs|cpp|c|rs|swift|kt|sh|bash|zsh|sql|env\.example)$/i;
        const MAX_FILES = 50;
        const MAX_FILE_SIZE = 100 * 1024; // 100 KB por arquivo

        const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
        const headers: any = { 'User-Agent': 'KSZap-AI-Processor/1.0' };
        const ghToken = process.env.GITHUB_TOKEN;
        if (ghToken) headers['Authorization'] = `Bearer ${ghToken}`;

        // Buscar a árvore de arquivos
        const treePath = cleanPath ? `${branch}:${cleanPath}` : branch;
        const axios = require('axios');

        let treeResp: any;
        try {
            treeResp = await axios.get(`${apiBase}/git/trees/${treePath}?recursive=1`, { headers, timeout: 15000 });
        } catch (treeErr: any) {
            if (treeErr.response?.status === 403) {
                throw new Error('Rate limit do GitHub atingido. Configure GITHUB_TOKEN para aumentar o limite.');
            }
            throw treeErr;
        }

        const tree: any[] = treeResp.data.tree || [];

        const textFiles = tree
            .filter(f => f.type === 'blob' && TEXT_EXTENSIONS.test(f.path) && f.size <= MAX_FILE_SIZE)
            .slice(0, MAX_FILES);

        if (textFiles.length === 0) throw new Error('Nenhum arquivo de texto encontrado no repositório');

        const parts: string[] = [`# Repositório: ${owner}/${repo}\n`];
        for (const file of textFiles) {
            try {
                const fileResp = await axios.get(`${apiBase}/contents/${cleanPath ? `${cleanPath}/` : ''}${file.path}?ref=${branch}`, { headers, timeout: 10000 });
                const content = Buffer.from(fileResp.data.content, 'base64').toString('utf-8');
                parts.push(`\n## Arquivo: ${file.path}\n\`\`\`\n${content}\n\`\`\``);
            } catch {
                this.logger.warn(`Não foi possível ler ${file.path}`);
            }
        }

        return parts.join('\n');
    }

    /**
     * Obtém buffer de conteúdo a partir de path local.
     * ARMAZENAMENTO 100% LOCAL - Sem S3
     */
    private async getContentBuffer(contentUrl: string): Promise<Buffer> {
        // Verificar se é path local
        if (fs.existsSync(contentUrl)) {
            try {
                const stats = fs.statSync(contentUrl);
                this.logger.log(`[getContentBuffer] Lendo arquivo local: ${contentUrl} (${stats.size} bytes)`);
                return fs.readFileSync(contentUrl);
            } catch (readErr: any) {
                this.logger.error(`[getContentBuffer] Erro ao ler arquivo: ${readErr.message}`);
                throw new Error(`Falha ao ler arquivo local: ${readErr.message}`);
            }
        }

        // Fallback para URL HTTP (não recomendado, mas mantido para compatibilidade)
        if (contentUrl.startsWith('http')) {
            const axios = require('axios');
            const response = await axios.get(contentUrl, { responseType: 'arraybuffer', timeout: 60000 });
            return Buffer.from(response.data);
        }

        throw new Error(`Arquivo não encontrado: ${contentUrl}`);
    }
}