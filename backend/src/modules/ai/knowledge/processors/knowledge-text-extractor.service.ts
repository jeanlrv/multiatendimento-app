import { Injectable, Logger } from '@nestjs/common';
import { ProviderConfigService } from '../../../settings/provider-config.service';
import * as fs from 'fs';

/**
 * KnowledgeTextExtractorService
 *
 * Centraliza toda a lógica de extração de texto de documentos (20+ formatos).
 * Separado do KnowledgeProcessor para facilitar testes unitários e manutenção.
 */
@Injectable()
export class KnowledgeTextExtractorService {
    private readonly logger = new Logger(KnowledgeTextExtractorService.name);

    constructor(private providerConfigService: ProviderConfigService) { }

    /**
     * Extrai texto de um documento baseado no sourceType.
     * Retorna texto + metadados (ex: número de páginas para PDF).
     */
    async extractTextWithMetadata(document: any): Promise<{ text: string; pageCount?: number }> {
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
                const text = this.extractXmlLeafPairs(src);
                return { text: text || '[XML sem conteúdo extraível]' };
            }

            case 'XSD': {
                const src = rawContent || (contentUrl ? (await this.getContentBuffer(contentUrl)).toString('utf-8') : '');
                const text = this.extractXsdSummary(src);
                return { text: text || '[XSD sem elementos encontrados]' };
            }

            case 'CSV': {
                const src = rawContent || (contentUrl ? (await this.getContentBuffer(contentUrl)).toString('utf-8') : '');
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
                    return headers.map((h, i) => `${h}: ${vals[i] ?? ''}`).join(' | ');
                }).filter(r => r.replace(/[|:\s]/g, ''));
                return { text: `${headers.join(', ')}\n\n${rows.join('\n')}` };
            }

            // ── PDF ───────────────────────────────────────────────────────────────
            case 'PDF': {
                if (!contentUrl) throw new Error('PDF requer contentUrl (arquivo local)');
                if (!fs.existsSync(contentUrl)) throw new Error(`Arquivo PDF não encontrado: ${contentUrl}`);

                const buffer = await this.getContentBuffer(contentUrl);

                let pdfParse: Function;
                try {
                    pdfParse = require('pdf-parse');
                    if (typeof pdfParse !== 'function') {
                        if (typeof (pdfParse as any).default === 'function') {
                            pdfParse = (pdfParse as any).default;
                        } else {
                            throw new Error('pdf-parse não exportou uma função. Verifique se a versão 1.1.1 está instalada.');
                        }
                    }
                } catch (loadErr: any) {
                    throw new Error(`Falha ao carregar pdf-parse: ${loadErr.message}`);
                }

                try {
                    const pdfData = await pdfParse(buffer, { normalizeWhitespace: true });

                    if (!pdfData.text || pdfData.text.trim().length === 0) {
                        const fallbackText = rawContent && rawContent.trim().length > 20 ? rawContent.trim() : null;
                        if (fallbackText) {
                            this.logger.warn(`[PDF] PDF escaneado — usando rawContent como fallback: ${contentUrl}`);
                            return { text: fallbackText, pageCount: pdfData.numpages };
                        }
                        const filename = contentUrl?.split('/').pop() || 'documento.pdf';
                        const minimalText = `[Documento sem texto extraível]\nArquivo: ${filename}\nObservação: Este PDF contém apenas imagens (PDF escaneado). Para ter o conteúdo indexado, converta o PDF para texto via OCR antes de enviar.`;
                        this.logger.warn(`[PDF] PDF escaneado — criando chunk de metadado mínimo: ${filename}`);
                        return { text: minimalText, pageCount: pdfData.numpages };
                    }

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
                if (!fs.existsSync(contentUrl)) throw new Error(`Arquivo DOCX não encontrado: ${contentUrl}`);

                const buffer = await this.getContentBuffer(contentUrl);
                const mammoth = require('mammoth');
                try {
                    const result = await mammoth.extractRawText({ buffer });
                    if (!result.value || result.value.trim().length === 0) {
                        this.logger.warn('[DOCX] Arquivo parece estar vazio ou conter apenas imagens');
                    }
                    const cleanText = (result.value || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
                    return { text: cleanText };
                } catch (extractErr: any) {
                    throw new Error(`Falha ao extrair texto do DOCX: ${extractErr.message}`);
                }
            }

            // ── XLSX / XLS ────────────────────────────────────────────────────────
            case 'XLSX':
            case 'XLS': {
                if (!contentUrl) throw new Error('XLSX/XLS requer contentUrl');
                if (!fs.existsSync(contentUrl)) throw new Error(`Arquivo ${type} não encontrado: ${contentUrl}`);

                const buffer = await this.getContentBuffer(contentUrl);
                const XLSX = require('xlsx');
                try {
                    const workbook = XLSX.read(buffer, { type: 'buffer' });
                    const parts: string[] = [];
                    for (const sheetName of workbook.SheetNames) {
                        const sheet = workbook.Sheets[sheetName];
                        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                        if (!rows || rows.length === 0) continue;
                        const header = rows[0] as string[];
                        const dataRows = rows.slice(1).filter((row: any[]) => row.some((cell: any) => cell !== ''));
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
                    if (parts.length === 0) this.logger.warn('[XLSX] Arquivo não contém dados nas planilhas');
                    return { text: parts.join('\n\n') };
                } catch (readErr: any) {
                    throw new Error(`Falha ao ler planilha: ${readErr.message}`);
                }
            }

            // ── PPTX ─────────────────────────────────────────────────────────────
            case 'PPTX': {
                if (!contentUrl) throw new Error('PPTX requer contentUrl');
                if (!fs.existsSync(contentUrl)) throw new Error(`Arquivo PPTX não encontrado: ${contentUrl}`);
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
                if (!fs.existsSync(contentUrl)) throw new Error(`Arquivo EPUB não encontrado: ${contentUrl}`);
                const buffer = await this.getContentBuffer(contentUrl);
                try {
                    const text = await this.extractEpubText(buffer);
                    if (!text || text.trim().length === 0) throw new Error('EPUB parece estar vazio ou protegido por DRM');
                    return { text };
                } catch (extractErr: any) {
                    if (extractErr.message.includes('DRM')) throw new Error('EPUB está protegido por DRM. Remova a proteção antes de enviar.');
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
                if (!fs.existsSync(contentUrl)) throw new Error(`Arquivo de áudio não encontrado: ${contentUrl}`);
                return { text: await this.transcribeAudio(contentUrl, document.knowledgeBase?.companyId) };
            }

            default:
                if (rawContent) return { text: rawContent };
                if (contentUrl) {
                    const buf = await this.getContentBuffer(contentUrl);
                    return { text: buf.toString('utf-8') };
                }
                throw new Error(`Tipo de documento não suportado: ${sourceType}`);
        }
    }

    // ── Helpers de limpeza ────────────────────────────────────────────────────

    private cleanPdfText(text: string): string {
        return text
            .replace(/(\w+)-\n(\w+)/g, '$1$2')
            .replace(/\n{3,}/g, '\n\n')
            .split('\n').map((line: string) => line.trimEnd()).join('\n')
            .replace(/[ \t]{2,}/g, ' ')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            .trim();
    }

    /**
     * Extrai campos de XML de dados (NFe, CTe, MDFe, etc.) usando parser de pilha.
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

        const SECTION_DEPTHS = new Set([2, 3]);
        const stack: string[] = [];
        const sibCount = new Map<string, number>();
        const sections: Array<{ label: string; lines: string[]; depth: number }> = [];
        const activeSectionAtDepth = new Map<number, number>();
        let curSectionIdx = -1;

        const re = /<(\/?)(?:[A-Za-z_][\w.]*:)?([A-Za-z_][\w.]*)([^>]*)>|([^<]+)/g;
        let m: RegExpExecArray | null;

        while ((m = re.exec(src)) !== null) {
            if (m[4] !== undefined) {
                const text = m[4].replace(/\s+/g, ' ').trim();
                if (!text || curSectionIdx < 0) continue;
                const val = decode(text);
                const curSec = sections[curSectionIdx];
                const pathAfterRoot = stack.slice(1);
                const leaf = pathAfterRoot[pathAfterRoot.length - 1];
                const ancestorsAfterSection = pathAfterRoot.slice(curSec.depth - 1, -1);
                const prefix = ancestorsAfterSection.slice(-2).join('/');
                curSec.lines.push(`${prefix ? prefix + '/' : ''}${leaf}: ${val}`);
            } else {
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
        return result || src.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    /**
     * Extrai dicionário de elementos de um XSD (XML Schema Definition).
     */
    private extractXsdSummary(xsd: string): string {
        const src = xsd
            .replace(/<\?xml[^>]*\?>/g, '')
            .replace(/<!--[\s\S]*?-->/g, '');

        const nameOrder: string[] = [];
        const nameToDoc = new Map<string, string>();

        const nameRe = /<xsd?:element\s[^>]*\bname="([^"]+)"/gi;
        let m: RegExpExecArray | null;
        while ((m = nameRe.exec(src)) !== null) {
            const name = m[1].trim();
            if (!nameToDoc.has(name)) { nameToDoc.set(name, ''); nameOrder.push(name); }
        }

        const annotRe = /<xsd?:annotation>([\s\S]*?)<\/xsd?:annotation>/gi;
        while ((m = annotRe.exec(src)) !== null) {
            const annotContent = m[1];
            const docMatch = annotContent.match(/<xsd?:documentation[^>]*>([\s\S]*?)<\/xsd?:documentation>/i);
            if (!docMatch) continue;
            const doc = docMatch[1].replace(/\s+/g, ' ').trim();
            if (!doc) continue;
            const before = src.substring(Math.max(0, m.index - 600), m.index);
            const prevElem = [...before.matchAll(/<xsd?:element\s[^>]*\bname="([^"]+)"/gi)].pop();
            if (prevElem) {
                const name = prevElem[1].trim();
                if (nameToDoc.has(name) && !nameToDoc.get(name)) nameToDoc.set(name, doc);
            }
        }

        const lines: string[] = ['=== Schema XSD — Elementos ==='];
        for (const name of nameOrder) {
            const doc = nameToDoc.get(name);
            lines.push(doc ? `${name}: ${doc}` : name);
        }

        const typeRe = /<xsd?:(?:simpleType|complexType)\s[^>]*\bname="([^"]+)"/gi;
        const types: string[] = [];
        while ((m = typeRe.exec(src)) !== null) types.push(m[1].trim());
        if (types.length > 0) { lines.push('\n=== Tipos Definidos ==='); lines.push(types.join(', ')); }

        const enumRe = /<xsd?:enumeration\s[^>]*\bvalue="([^"]+)"/gi;
        const enums: string[] = [];
        while ((m = enumRe.exec(src)) !== null) enums.push(m[1].trim());
        if (enums.length > 0 && enums.length <= 100) { lines.push('\n=== Valores Enumerados ==='); lines.push(enums.join(', ')); }

        return lines.join('\n');
    }

    private extractHtmlText(html: string): string {
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
        $('script, style, nav, header, footer, aside, .ads, .advertisement, [aria-hidden="true"]').remove();
        $('h1, h2, h3, h4, h5, h6').each((_: number, el: any) => { $(el).prepend('\n\n## '); $(el).append('\n\n'); });
        $('p, li, td, th, br').each((_: number, el: any) => { $(el).append('\n'); });
        return $('body').text().replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
    }

    private async extractPptxText(buffer: Buffer): Promise<string> {
        const JSZip = require('jszip');
        const zip = await JSZip.loadAsync(buffer);
        const slideTexts: string[] = [];
        const slideFiles = Object.keys(zip.files).filter(name => name.match(/^ppt\/slides\/slide\d+\.xml$/)).sort();
        for (const slideFile of slideFiles) {
            const xml = await zip.files[slideFile].async('text');
            const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
            const text = matches.map((m: string) => m.replace(/<[^>]+>/g, '').trim()).filter((t: string) => t.length > 0).join(' ');
            if (text) slideTexts.push(`[Slide ${slideTexts.length + 1}] ${text}`);
        }
        if (slideTexts.length === 0) this.logger.warn('[PPTX] Nenhum texto encontrado nos slides');
        return slideTexts.join('\n\n');
    }

    private async extractEpubText(buffer: Buffer): Promise<string> {
        const JSZip = require('jszip');
        const zip = await JSZip.loadAsync(buffer);
        const texts: string[] = [];
        const htmlFiles = Object.keys(zip.files).filter(name => name.match(/\.(html|xhtml|htm)$/i) && !zip.files[name].dir);
        for (const htmlFile of htmlFiles) {
            const content = await zip.files[htmlFile].async('text');
            const text = this.extractHtmlText(content);
            if (text.trim()) texts.push(text);
        }
        if (texts.length === 0) throw new Error('Nenhum texto encontrado no EPUB (pode estar protegido por DRM)');
        return texts.join('\n\n---\n\n');
    }

    /**
     * Transcreve áudio via Whisper (local ou OpenAI API).
     */
    private async transcribeAudio(audioUrl: string, companyId?: string): Promise<string> {
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

        const ext = audioUrl.split('.').pop()?.toLowerCase() || 'mp3';
        const nativeWhisperExts = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg'];
        const localServerExts = [...nativeWhisperExts, 'opus', 'oga', 'aac', 'amr', '3gp', '3gpp', 'flac'];
        const supportedExts = whisperBaseUrl ? localServerExts : nativeWhisperExts;
        const finalExt = supportedExts.includes(ext) ? ext : 'mp3';

        const file = await toFile(buffer, `audio.${finalExt}`);
        const model = process.env.WHISPER_MODEL || 'whisper-1';

        const transcription = await openai.audio.transcriptions.create({
            file,
            model,
            language: 'pt',
            response_format: 'text',
        });

        const text = typeof transcription === 'string' ? transcription : (transcription as any).text;
        if (!text) throw new Error('Whisper não retornou transcrição');
        return `[Transcrição de áudio]\n\n${text}`;
    }

    private async extractYouTubeTranscript(url: string): Promise<string> {
        this.logger.log(`Extraindo transcrição do YouTube: ${url}`);
        const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (!match) throw new Error('URL do YouTube inválida. Use formato: https://youtube.com/watch?v=ID ou https://youtu.be/ID');
        const videoId = match[1];

        const { YoutubeTranscript } = require('youtube-transcript');
        let transcriptItems: any[] = [];
        const langPriority = ['pt', 'pt-BR', 'en'];
        let lastError: Error | null = null;

        for (const lang of langPriority) {
            try {
                transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, { lang });
                if (transcriptItems?.length) break;
            } catch (err) { lastError = err; }
        }

        if (!transcriptItems?.length) {
            try { transcriptItems = await YoutubeTranscript.fetchTranscript(videoId); } catch (err) { lastError = err; }
        }

        if (!transcriptItems?.length) {
            const baseMsg = 'Este vídeo do YouTube não possui transcrição/legenda disponível';
            const hint = lastError?.message ? ` (${lastError.message})` : '';
            throw new Error(`${baseMsg}${hint}. Certifique-se de que o vídeo tem legendas automáticas ou manuais ativadas.`);
        }

        const text = transcriptItems.map((item: any) => item.text).join(' ');
        return `[Transcrição do YouTube: ${url}]\n\n${text}`;
    }

    private async extractGitHubContent(url: string): Promise<string> {
        this.logger.log(`Extraindo conteúdo do GitHub: ${url}`);
        const match = url.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)(.*))?/);
        if (!match) throw new Error('URL do GitHub inválida. Use: https://github.com/owner/repo');

        const [, owner, repo, branch = 'HEAD', subPath = ''] = match;
        const cleanPath = subPath.replace(/^\//, '');
        const TEXT_EXTENSIONS = /\.(md|mdx|txt|rst|csv|json|yaml|yml|xml|html|htm|js|ts|jsx|tsx|py|java|go|rb|php|cs|cpp|c|rs|swift|kt|sh|bash|zsh|sql|env\.example)$/i;
        const MAX_FILES = 50;
        const MAX_FILE_SIZE = 100 * 1024;

        const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
        const headers: any = { 'User-Agent': 'KSZap-AI-Processor/1.0' };
        const ghToken = process.env.GITHUB_TOKEN;
        if (ghToken) headers['Authorization'] = `Bearer ${ghToken}`;

        const treePath = cleanPath ? `${branch}:${cleanPath}` : branch;
        const axios = require('axios');

        let treeResp: any;
        try {
            treeResp = await axios.get(`${apiBase}/git/trees/${treePath}?recursive=1`, { headers, timeout: 15000 });
        } catch (treeErr: any) {
            if (treeErr.response?.status === 403) throw new Error('Rate limit do GitHub atingido. Configure GITHUB_TOKEN para aumentar o limite.');
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

    private async getContentBuffer(contentUrl: string): Promise<Buffer> {
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

        if (contentUrl.startsWith('http')) {
            const axios = require('axios');
            const response = await axios.get(contentUrl, { responseType: 'arraybuffer', timeout: 60000 });
            return Buffer.from(response.data);
        }

        throw new Error(`Arquivo não encontrado: ${contentUrl}`);
    }
}
