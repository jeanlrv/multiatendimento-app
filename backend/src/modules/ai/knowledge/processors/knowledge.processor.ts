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
            const document = await (this.prisma as any).document.findUnique({
                where: { id: documentId },
                include: { knowledgeBase: true },
            });

            if (!document) throw new Error('Documento não encontrado');

            // 2. Atualiza status para PROCESSING
            await (this.prisma as any).document.update({
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

                    // Metadata do chunk: índice global e, se disponível, info de página
                    const chunkIndex = i + j;
                    const metadata: any = { chunkIndex };
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
                    await (this.prisma as any).documentChunk.createMany({ data: chunkData });
                    processedCount += chunkData.length;
                    this.logger.log(`Documento ${documentId} - lote inserido: ${processedCount}/${chunkCount} chunks.`);
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }

            // 6. Finaliza documento
            await (this.prisma as any).document.update({
                where: { id: documentId },
                data: {
                    status: 'READY',
                    chunkCount,
                    rawContent: text.substring(0, 100000),
                },
            });

            if (embeddingFailed) {
                this.logger.warn(`Documento ${documentId} salvo como READY sem embeddings (apenas FTS). Razão: ${embeddingFailReason}`);
            } else {
                this.logger.log(`Documento ${documentId} processado com sucesso: ${chunkCount} chunks (provider: ${embeddingProvider}).`);
            }
            return { success: true, chunkCount, embeddingFailed };

        } catch (error: any) {
            this.logger.error(`[Processador] Erro ao processar documento ${documentId}: ${error.message}`, error.stack);
            await (this.prisma as any).document.update({
                where: { id: documentId },
                data: {
                    status: 'ERROR',
                    rawContent: `ERRO: ${error.message?.substring(0, 900) || 'Erro desconhecido'}\n\nVerifique o tipo do arquivo e se ele está corrompido.`
                },
            });
            throw error;
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
                // Strip XML tags, preservar conteúdo de texto
                const text = src
                    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
                    .replace(/\s+/g, ' ').trim();
                return { text };
            }

            case 'CSV': {
                const src = rawContent || (contentUrl ? (await this.getContentBuffer(contentUrl)).toString('utf-8') : '');
                const lines = src.split('\n').filter(l => l.trim());
                return { text: lines.join('\n') };
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
                        throw new Error(
                            'PDF parece ser escaneado (sem camada de texto). ' +
                            'Para PDFs escaneados, converta para texto usando OCR antes de enviar.'
                        );
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

                return { text: await this.transcribeAudio(contentUrl) };
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
     * Transcreve áudio via OpenAI Whisper API.
     */
    private async transcribeAudio(audioUrl: string): Promise<string> {
        const openAiKey = process.env.OPENAI_API_KEY;
        if (!openAiKey) throw new Error('OPENAI_API_KEY necessária para transcrição de áudio (Whisper)');

        this.logger.log(`Transcrevendo áudio via Whisper: ${audioUrl}`);

        const buffer = await this.getContentBuffer(audioUrl);
        const { OpenAI } = require('openai');
        const openai = new OpenAI({ apiKey: openAiKey });

        // Determinar extensão do arquivo
        const ext = audioUrl.split('.').pop()?.toLowerCase() || 'mp3';
        const filename = `audio.${ext}`;

        // Whisper aceita: mp3, mp4, mpeg, mpga, m4a, wav, webm
        const validExts = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg'];
        const finalExt = validExts.includes(ext) ? ext : 'mp3';

        const { toFile } = require('openai');
        const file = await toFile(buffer, `audio.${finalExt}`);

        const transcription = await openai.audio.transcriptions.create({
            file,
            model: 'whisper-1',
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