import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../../database/prisma.service';
import { VectorStoreService } from '../../engine/vector-store.service';
import { ProviderConfigService } from '../../../settings/provider-config.service';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import axios from 'axios';
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
        this.logger.log(`Iniciando processamento do documento: ${documentId}`);

        try {
            // 1. Busca o documento e a base de conhecimento (para pegar embedding provider)
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
            const text = await this.extractText(document);

            if (!text || text.trim().length === 0) {
                throw new Error('Falha ao extrair texto do documento ou documento vazio');
            }

            // 4. Chunking
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });
            const chunks = await splitter.splitText(text);

            // 5. Gera embeddings usando o provider da base de conhecimento
            let embeddingProvider = document.knowledgeBase?.embeddingProvider || 'openai';
            let embeddingModel = document.knowledgeBase?.embeddingModel || undefined;

            // Busca API key da empresa para o provider de embedding configurado
            let embeddingApiKey: string | undefined;
            let embeddingBaseUrl: string | undefined;
            try {
                const providerConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
                const providerConfig = providerConfigs.get(embeddingProvider);
                embeddingApiKey = providerConfig?.apiKey ?? undefined;
                embeddingBaseUrl = providerConfig?.baseUrl ?? undefined;
            } catch (cfgErr) {
                this.logger.warn(`Não foi possível carregar configs do provider ${embeddingProvider}: ${cfgErr.message}`);
            }

            this.logger.log(`[Processor] Documento ${documentId} — provider: ${embeddingProvider}, model: ${embeddingModel ?? 'default'}, apiKey: ${embeddingApiKey ? 'configurada' : 'não encontrada (usará env var)'}`);

            // Validação antecipada: se o provider precisa de API key e não encontramos, abortar cedo.
            // Exceção: se AnythingLLM estiver configurado ou for 'native/ollama', prosseguir.
            const requiresKey = !['native', 'ollama'].includes(embeddingProvider);
            const anythingllmFallbackAvailable = (() => {
                const u = process.env.ANYTHINGLLM_BASE_URL || process.env.ANYTHINGLLM_API_URL;
                const k = process.env.ANYTHINGLLM_API_KEY;
                return !!(u && k && k !== 'your-anythingllm-api-key' && embeddingProvider !== 'anythingllm');
            })();

            if (requiresKey && !embeddingApiKey && !process.env.OPENAI_API_KEY && !process.env[`${embeddingProvider.toUpperCase()}_API_KEY`]) {
                if (anythingllmFallbackAvailable) {
                    this.logger.warn(`Provider '${embeddingProvider}' sem chave, mas fallback AnythingLLM disponível.`);
                } else {
                    throw new Error(
                        `Provider '${embeddingProvider}' requer API key, mas nenhuma foi encontrada ` +
                        `(nem nas configurações da empresa nem nas variáveis de ambiente). ` +
                        `Configure em Configurações > IA & Modelos.`
                    );
                }
            }

            // Gera embeddings e acumula dados para inserção em lote
            const chunkData: { documentId: string; content: string; embedding?: any }[] = [];

            for (const content of chunks) {
                let embedding: number[] | null = null;
                try {
                    embedding = await this.vectorStore.generateEmbedding(
                        content, embeddingProvider, embeddingModel, embeddingApiKey, embeddingBaseUrl
                    );
                } catch (embErr) {
                    // Fallback para AnythingLLM quando configurado: usa HTTP puro (OpenAI-compat),
                    // sem libs nativas/WASM — seguro em Railway e qualquer container de produção.
                    const anythingllmUrl = process.env.ANYTHINGLLM_BASE_URL || process.env.ANYTHINGLLM_API_URL;
                    const anythingllmKey = process.env.ANYTHINGLLM_API_KEY;
                    const canFallback = anythingllmUrl
                        && anythingllmKey
                        && anythingllmKey !== 'your-anythingllm-api-key'
                        && embeddingProvider !== 'anythingllm';

                    if (canFallback) {
                        this.logger.warn(
                            `[Processor] Provider '${embeddingProvider}' falhou: ${embErr.message}. ` +
                            `Fallback AnythingLLM para os demais chunks deste documento.`
                        );
                        // Permanente: próximos chunks já usam AnythingLLM diretamente
                        embeddingProvider = 'anythingllm';
                        embeddingModel = 'anythingllm:embedding';
                        embeddingApiKey = anythingllmKey!;
                        embeddingBaseUrl = anythingllmUrl!;
                        embedding = await this.vectorStore.generateEmbedding(
                            content, embeddingProvider, embeddingModel, embeddingApiKey, embeddingBaseUrl
                        );
                    } else {
                        // Sem fallback disponível: marcar documento como ERROR com mensagem clara
                        throw new Error(
                            `Falha ao gerar embedding com provider '${embeddingProvider}': ${embErr.message}. ` +
                            `Configure um provider válido em Configurações > IA & Modelos e reprocesse o documento.`
                        );
                    }
                }

                chunkData.push({
                    documentId,
                    content,
                    embedding: embedding && embedding.length > 0 ? (embedding as any) : undefined,
                });
            }

            // Insere todos os chunks em uma única query (createMany)
            await (this.prisma as any).documentChunk.createMany({ data: chunkData });
            const chunkCount = chunkData.length;

            // 6. Finaliza documento
            await (this.prisma as any).document.update({
                where: { id: documentId },
                data: {
                    status: 'READY',
                    chunkCount,
                    rawContent: text.substring(0, 100000), // limite de 100k chars para armazenamento
                },
            });

            this.logger.log(`Documento ${documentId} processado: ${chunkCount} chunks (provider: ${embeddingProvider}).`);
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
     * Extrai texto de um documento baseado no seu sourceType.
     */
    private async extractText(document: any): Promise<string> {
        const { sourceType, contentUrl, rawContent } = document;
        const type = sourceType?.toUpperCase();

        switch (type) {
            // ── Texto puro ──────────────────────────────────────────────────────
            case 'TEXT':
            case 'TXT':
            case 'MD':
            case 'MARKDOWN':
            case 'CODE':
            case 'RTF':
                if (rawContent) return rawContent;
                if (contentUrl) {
                    const buf = await this.getContentBuffer(contentUrl);
                    let text = buf.toString('utf-8');
                    // Para RTF: remover control codes
                    if (type === 'RTF') text = text.replace(/\\[a-z]+\d*\s?|[{}]|[^a-zA-Z0-9\s\.,;:!?'"()\-]/g, ' ').replace(/\s+/g, ' ').trim();
                    return text;
                }
                return '';

            // ── Dados estruturados ───────────────────────────────────────────────
            case 'JSON':
                if (rawContent) return rawContent;
                if (contentUrl) {
                    const buf = await this.getContentBuffer(contentUrl);
                    try {
                        const parsed = JSON.parse(buf.toString('utf-8'));
                        return JSON.stringify(parsed, null, 2);
                    } catch {
                        return buf.toString('utf-8');
                    }
                }
                return '';

            case 'YAML':
            case 'YML': {
                const src = rawContent || (contentUrl ? (await this.getContentBuffer(contentUrl)).toString('utf-8') : '');
                try {
                    const yaml = require('yaml');
                    const parsed = yaml.parse(src);
                    return JSON.stringify(parsed, null, 2);
                } catch {
                    return src;
                }
            }

            case 'XML': {
                const src = rawContent || (contentUrl ? (await this.getContentBuffer(contentUrl)).toString('utf-8') : '');
                // Strip XML tags, preservar conteúdo de texto
                return src
                    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
                    .replace(/\s+/g, ' ').trim();
            }

            case 'CSV': {
                const src = rawContent || (contentUrl ? (await this.getContentBuffer(contentUrl)).toString('utf-8') : '');
                // Converte CSV para texto legível
                const lines = src.split('\n').filter(l => l.trim());
                return lines.join('\n');
            }

            // ── Documentos Office ────────────────────────────────────────────────
            case 'PDF': {
                if (!contentUrl) throw new Error('PDF requer contentUrl');
                const buffer = await this.getContentBuffer(contentUrl);
                const pdf = require('pdf-parse');
                const pdfData = await pdf(buffer);
                return pdfData.text;
            }

            case 'DOCX': {
                if (!contentUrl) throw new Error('DOCX requer contentUrl');
                const buffer = await this.getContentBuffer(contentUrl);
                const mammoth = require('mammoth');
                const result = await mammoth.extractRawText({ buffer });
                return result.value;
            }

            case 'XLSX':
            case 'XLS': {
                if (!contentUrl) throw new Error('XLSX/XLS requer contentUrl');
                const buffer = await this.getContentBuffer(contentUrl);
                const XLSX = require('xlsx');
                const workbook = XLSX.read(buffer, { type: 'buffer' });
                const parts: string[] = [];
                for (const sheetName of workbook.SheetNames) {
                    const sheet = workbook.Sheets[sheetName];
                    const csv = XLSX.utils.sheet_to_csv(sheet);
                    parts.push(`=== Planilha: ${sheetName} ===\n${csv}`);
                }
                return parts.join('\n\n');
            }

            case 'PPTX': {
                if (!contentUrl) throw new Error('PPTX requer contentUrl');
                const buffer = await this.getContentBuffer(contentUrl);
                return await this.extractPptxText(buffer);
            }

            case 'EPUB': {
                if (!contentUrl) throw new Error('EPUB requer contentUrl');
                const buffer = await this.getContentBuffer(contentUrl);
                return await this.extractEpubText(buffer);
            }

            // ── HTML / Web ───────────────────────────────────────────────────────
            case 'HTML':
            case 'HTM': {
                const src = rawContent || (contentUrl ? (await axios.get(contentUrl)).data : '');
                return this.extractHtmlText(src);
            }

            case 'URL': {
                if (!contentUrl) throw new Error('URL requer contentUrl');
                const isYouTube = /youtube\.com\/watch|youtu\.be\//.test(contentUrl);
                const isGitHub = /github\.com\//.test(contentUrl);

                if (isYouTube) return await this.extractYouTubeTranscript(contentUrl);
                if (isGitHub) return await this.extractGitHubContent(contentUrl);

                const response = await axios.get(contentUrl, { timeout: 30000 });
                return this.extractHtmlText(response.data);
            }

            case 'YOUTUBE': {
                const url = contentUrl || rawContent;
                if (!url) throw new Error('YOUTUBE requer URL no contentUrl');
                return await this.extractYouTubeTranscript(url);
            }

            case 'GITHUB': {
                const url = contentUrl || rawContent;
                if (!url) throw new Error('GITHUB requer URL do repositório no contentUrl');
                return await this.extractGitHubContent(url);
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
                return await this.transcribeAudio(contentUrl);
            }

            default:
                // Tentativa genérica de ler como texto
                if (rawContent) return rawContent;
                if (contentUrl) {
                    const buf = await this.getContentBuffer(contentUrl);
                    return buf.toString('utf-8');
                }
                throw new Error(`Tipo de documento não suportado: ${sourceType}`);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers de extração
    // ──────────────────────────────────────────────────────────────────────────

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

        if (slideTexts.length === 0) throw new Error('Nenhum texto encontrado no PPTX');
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

        if (texts.length === 0) throw new Error('Nenhum texto encontrado no EPUB');
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
        if (!match) throw new Error('URL do YouTube inválida');
        const videoId = match[1];

        const { YoutubeTranscript } = require('youtube-transcript');
        let transcriptItems: any[];

        try {
            transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'pt' });
        } catch {
            // Tentar sem preferência de idioma
            transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
        }

        if (!transcriptItems?.length) {
            throw new Error('Este vídeo do YouTube não possui transcrição disponível');
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
        const treeResp = await axios.get(`${apiBase}/git/trees/${treePath}?recursive=1`, { headers, timeout: 15000 });
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
     * Obtém buffer de conteúdo a partir de URL ou path local.
     */
    private async getContentBuffer(contentUrl: string): Promise<Buffer> {
        if (contentUrl.startsWith('http')) {
            const response = await axios.get(contentUrl, { responseType: 'arraybuffer', timeout: 60000 });
            return Buffer.from(response.data);
        }
        if (fs.existsSync(contentUrl)) {
            return fs.readFileSync(contentUrl);
        }
        throw new Error(`Arquivo não encontrado: ${contentUrl}`);
    }
}
